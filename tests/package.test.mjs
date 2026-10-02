import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('packaged XPI declares the compatibility bounds required by Zotero 10', () => {
	const manifest = JSON.parse(execFileSync('unzip', [
		'-p', `dist/zotero-ferry-${pkg.version}.xpi`, 'manifest.json',
	], { cwd: root, encoding: 'utf8' }));
	const target = manifest.applications.zotero;
	assert.equal(manifest.version, pkg.version);
	assert.equal(target.strict_min_version, '10.0');
	// Omitting strict_max_version causes Zotero's installer to reject the XPI
	// as corrupt, even though generic Gecko manifests can omit it.
	assert.equal(target.strict_max_version, '10.*');
	assert.ok(target.id);
	assert.match(target.update_url, /^https:\/\/github\.com\//);
	const update = JSON.parse(read('dist/update.json')).addons[target.id].updates[0];
	assert.equal(update.version, manifest.version);
	assert.deepEqual(update.applications.zotero, {
		strict_min_version: target.strict_min_version,
		strict_max_version: target.strict_max_version,
	});
	assert.ok(update.update_link.endsWith(`/v${pkg.version}/zotero-ferry-${pkg.version}.xpi`));
});

test('bootstrap starts the real bundled API with Zotero’s string rootURI', async () => {
	const loaded = [];
	const registered = [];
	const removed = [];
	const messages = [];
	const context = vm.createContext({
		Zotero: {
			initializationPromise: Promise.resolve(),
			debug: (message) => messages.push(message),
			logError: (error) => { throw error; },
			PreferencePanes: {
				register: async (options) => { registered.push(options); return options.id; },
				unregister: (id) => removed.push(id),
			},
		},
		IOUtils: {},
		Services: {
			wm: { getEnumerator: () => ({ hasMoreElements: () => false }) },
			scriptloader: {
				loadSubScript(uri, scope) {
					loaded.push(uri);
					vm.runInNewContext(read('build/main.js'), scope);
				},
			},
		},
	});
	vm.runInContext(read('bootstrap.js'), context);
	const data = {
		id: 'zotero-ferry@ebawak-fekede.github.io',
		rootURI: 'jar:file:///test/zotero-ferry.xpi!/',
	};
	await context.startup(data, 5);
	assert.deepEqual(loaded, [data.rootURI + 'main.js']);
	assert.equal(registered.length, 1);
	assert.equal(registered[0].pluginID, data.id);
	assert.equal(registered[0].src, 'prefs.xhtml');
	assert.deepEqual(messages, ['zotero-ferry: ready']);
	context.shutdown(data, 4);
	assert.deepEqual(removed, ['zotero-ferry-preferences']);
	assert.equal(context.FerryBundle, null);
	assert.equal(context.FerryScope, null);
});

test('custom origin and status preferences use the global preference namespace', async () => {
	const memory = await import('../build/memory.mjs');
	const calls = [];
	globalThis.Zotero = {
		Prefs: {
			get(key, global) {
				calls.push({ key, global });
				return global ? {
					'extensions.zotero-ferry.storedTag': 'Stored for reading',
					'extensions.zotero-ferry.originTagPrefix': 'my-origin:',
				}[key] : undefined;
			},
		},
	};
	try {
		assert.equal(memory.storedTag(), 'Stored for reading');
		assert.equal(memory.getOrigin({ getTags: () => [{ tag: 'my-origin:attachments:book.pdf' }] }), 'attachments:book.pdf');
		assert.ok(calls.every(call => call.global === true));
	} finally {
		delete globalThis.Zotero;
	}
});
