/**
 * Zotero 7 bootstrapped-extension entry point.
 *
 * Everything real lives in main.js (bundled from src/). This file only wires the
 * plugin lifecycle so the bundle can stay a plain IIFE with a single global.
 */
var FerryBundle;

function install(data, reason) {}

async function startup(data, reason) {
	// Zotero may not be fully ready when a plugin starts; wait it out.
	if (typeof Zotero !== 'undefined' && Zotero.initializationPromise) {
		await Zotero.initializationPromise;
	}

	Services.scriptloader.loadSubScript(data.rootURI.spec + 'main.js');

	FerryBundle = ZoteroFerry;
	if (FerryBundle && typeof FerryBundle.init === 'function') {
		await FerryBundle.init(data);
	}
}

function shutdown(data, reason) {
	if (FerryBundle && typeof FerryBundle.shutdown === 'function') {
		FerryBundle.shutdown();
	}
	FerryBundle = null;
}

function uninstall(data, reason) {}
