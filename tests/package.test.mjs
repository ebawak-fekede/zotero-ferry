import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));

test("packaged XPI declares the compatibility bounds required by Zotero 10", () => {
  const manifest = JSON.parse(
    execFileSync("unzip", ["-p", `dist/zotero-ferry-${pkg.version}.xpi`, "manifest.json"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  const target = manifest.applications.zotero;
  assert.equal(manifest.version, pkg.version);
  assert.equal(target.strict_min_version, "10.0");
  // Omitting strict_max_version causes Zotero's installer to reject the XPI
  // as corrupt, even though generic Gecko manifests can omit it.
  assert.equal(target.strict_max_version, "10.*");
  assert.ok(target.id);
  assert.match(target.update_url, /^https:\/\/github\.com\//);
  const update = JSON.parse(read("dist/update.json")).addons[target.id].updates[0];
  assert.equal(update.version, manifest.version);
  assert.deepEqual(update.applications.zotero, {
    strict_min_version: target.strict_min_version,
    strict_max_version: target.strict_max_version,
  });
  assert.ok(update.update_link.endsWith(`/v${pkg.version}/zotero-ferry-${pkg.version}.xpi`));
});

test("bootstrap starts the real bundled API with Zotero’s string rootURI", async () => {
  const loaded = [];
  const messages = [];
  const context = vm.createContext({
    Zotero: {
      getMainWindows: () => [],
      initializationPromise: Promise.resolve(),
      debug: (message) => messages.push(message),
      logError: (error) => {
        throw error;
      },
    },
    IOUtils: {},
    Services: {
      wm: { getEnumerator: () => [] },
      scriptloader: {
        loadSubScript(uri, scope) {
          loaded.push(uri);
          vm.runInNewContext(read("build/main.js"), scope);
        },
      },
    },
  });
  vm.runInContext(read("bootstrap.js"), context);
  const data = {
    id: "zotero-ferry@ebawak-fekede.github.io",
    rootURI: "jar:file:///test/zotero-ferry.xpi!/",
  };
  await context.startup(data, 5);
  assert.deepEqual(loaded, [data.rootURI + "main.js"]);
  assert.deepEqual(messages, ["zotero-ferry: ready"]);
  context.shutdown(data, 4);
  assert.equal(context.FerryBundle, null);
  assert.equal(context.FerryScope, null);
});
