/**
 * Build script for zotero-ferry.
 *
 *   node build.mjs        -> bundle src/index.ts -> build/main.js (IIFE, global `ZoteroFerry`)
 *                            copy manifest/bootstrap/prefs/locale into build/
 *                            zip build/ -> dist/zotero-ferry-<version>.xpi
 *                            write dist/update.json (Zotero's auto-update manifest)
 *
 *   node build.mjs --lib  -> also emit build/paths.mjs + build/memory.mjs (ESM, unbundled)
 *                            so `node --test tests/` can import the pure logic directly.
 */
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(root, 'build');
const distDir = path.join(root, 'dist');
const wantLib = process.argv.includes('--lib');

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

const extensionId = manifest.applications.zotero.id;
const repoUrl = 'https://github.com/ebawak-fekede/zotero-ferry';
const xpiName = `zotero-ferry-${pkg.version}.xpi`;

await rm(buildDir, { recursive: true, force: true });
await mkdir(buildDir, { recursive: true });

// 1. Bundle the plugin entry into a single IIFE exposing the `ZoteroFerry` global.
await build({
  entryPoints: [path.join(root, 'src/index.ts')],
  outfile: path.join(buildDir, 'main.js'),
  bundle: true,
  format: 'iife',
  globalName: 'ZoteroFerry',
  target: ['firefox128'],
  platform: 'neutral',
  mainFields: ['module', 'main'],
  logLevel: 'info',
  legalComments: 'none',
});

// 2. Optionally emit the pure-logic modules unbundled for the unit tests.
if (wantLib) {
  for (const name of ['paths', 'memory']) {
    await build({
      entryPoints: [path.join(root, `src/${name}.ts`)],
      outfile: path.join(buildDir, `${name}.mjs`),
      bundle: false,
      format: 'esm',
      target: ['node20'],
      platform: 'neutral',
      logLevel: 'info',
      legalComments: 'none',
    });
  }
}

// 3. Copy the static plugin payload alongside the bundle. manifest.json gets the
//    version injected from package.json so `pnpm bump:*` cannot let the two drift
//    apart — `npm version` only rewrites package.json.
for (const entry of ['bootstrap.js', 'prefs.js', 'prefs.xhtml', 'locale']) {
  const from = path.join(root, entry);
  if (existsSync(from)) {
    await cp(from, path.join(buildDir, entry), { recursive: true });
  }
}
manifest.version = pkg.version;
await writeFile(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// 4. Package the .xpi — plugin payload only, never the test-only .mjs modules.
await mkdir(distDir, { recursive: true });
const xpi = path.join(distDir, xpiName);
await rm(xpi, { force: true });
const payload = ['bootstrap.js', 'manifest.json', 'main.js', 'prefs.js', 'prefs.xhtml', 'locale'];
execFileSync('zip', ['-r', '-q', xpi, ...payload], { cwd: buildDir, stdio: 'inherit' });

// 5. Emit the auto-update manifest Zotero polls via `update_url`.
//
// `update_url` in manifest.json points at the *latest* release asset
// (`releases/latest/download/update.json`), so this file travels with each
// release and Zotero always sees the newest one without a commit to `main`.
// No `update_hash` — it is optional, and omitting it avoids a class of silent
// update failures if the digest format ever disagrees with Gecko.
const updateManifest = {
  addons: {
    [extensionId]: {
      updates: [
        {
          version: pkg.version,
          update_link: `${repoUrl}/releases/download/v${pkg.version}/${xpiName}`,
          applications: {
            zotero: {
              strict_min_version: manifest.applications.zotero.strict_min_version,
            },
          },
        },
      ],
    },
  },
};
await writeFile(
  path.join(distDir, 'update.json'),
  JSON.stringify(updateManifest, null, 2) + '\n'
);

console.log(`\nbuilt ${xpi}`);
console.log(`built ${path.join(distDir, 'update.json')}`);
