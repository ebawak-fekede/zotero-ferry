import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
const output = path.join(root, "build");
const dist = path.join(root, "dist");

// Compile the plugin and the conversion module used by tests.

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [path.join(root, "src/index.ts")],
  outfile: path.join(output, "main.js"),
  bundle: true,
  format: "iife",
  globalName: "ZoteroFerry",
  target: "firefox140",
  platform: "neutral",
  legalComments: "none",
});
// Tests exercise the same conversion code used by the add-on.
await build({
  entryPoints: [path.join(root, "src/attachments.ts")],
  outfile: path.join(output, "attachments.mjs"),
  format: "esm",
  target: "node24",
  platform: "neutral",
});
manifest.version = pkg.version;
await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await cp(path.join(root, "bootstrap.js"), path.join(output, "bootstrap.js"));

const name = `zotero-ferry-${pkg.version}.xpi`;
const xpi = path.join(dist, name);
await rm(xpi, { force: true });
execFileSync("zip", ["-q", xpi, "bootstrap.js", "manifest.json", "main.js"], { cwd: output });

const target = manifest.applications.zotero;

// Publish the stable update feed alongside the release package.

await writeFile(
  path.join(dist, "update.json"),
  JSON.stringify(
    {
      addons: {
        [target.id]: {
          updates: [
            {
              version: pkg.version,
              update_link: `https://github.com/ebawak-fekede/zotero-ferry/releases/download/v${pkg.version}/${name}`,
              applications: {
                zotero: {
                  strict_min_version: target.strict_min_version,
                  strict_max_version: target.strict_max_version,
                },
              },
            },
          ],
        },
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(`Built ${xpi} and update.json`);
