/**
 * Build script for zotero-ferry.
 *
 *   node build.mjs        -> bundle src/index.ts -> build/main.js (IIFE, global `ZoteroFerry`)
 *                            copy manifest/bootstrap/prefs/locale into build/
 *                            zip build/ -> dist/zotero-ferry-<version>.xpi
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

// 3. Copy the static plugin payload alongside the bundle.
for (const entry of ['manifest.json', 'bootstrap.js', 'prefs.js', 'prefs.xhtml', 'locale']) {
  const from = path.join(root, entry);
  if (existsSync(from)) {
    await cp(from, path.join(buildDir, entry), { recursive: true });
  }
}

// 4. Package the .xpi — plugin payload only, never the test-only .mjs modules.
await mkdir(distDir, { recursive: true });
const xpi = path.join(distDir, `zotero-ferry-${pkg.version}.xpi`);
await rm(xpi, { force: true });
const payload = ['bootstrap.js', 'manifest.json', 'main.js', 'prefs.js', 'prefs.xhtml', 'locale'];
execFileSync('zip', ['-r', '-q', xpi, ...payload], { cwd: buildDir, stdio: 'inherit' });

console.log(`\nbuilt ${xpi}`);
