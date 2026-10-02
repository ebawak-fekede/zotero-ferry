/**
 * Zotero 10 bootstrapped-extension entry point.
 *
 * Everything real lives in main.js (bundled from src/). This file only wires the
 * plugin lifecycle so the bundle can stay a plain IIFE with a single global.
 */
var FerryBundle;
var FerryScope;

function install(data, reason) {}

async function startup(data, reason) {
	try {
		await Zotero.initializationPromise;
		// Zotero supplies rootURI as a string. Load the IIFE into an explicit scope,
		// then retrieve the default export from esbuild's module namespace.
		const rootURI = typeof data.rootURI === 'string' ? data.rootURI : data.rootURI.spec;
		FerryScope = { Zotero, Services, IOUtils };
		Services.scriptloader.loadSubScript(rootURI + 'main.js', FerryScope);

		FerryBundle = FerryScope.ZoteroFerry.default;
		if (!FerryBundle || typeof FerryBundle.init !== 'function') {
			throw new Error('Zotero Ferry bundle did not expose its startup API');
		}
		await FerryBundle.init(data);
	} catch (error) {
		Zotero.logError(error);
		throw error;
	}
}

function shutdown(data, reason) {
	if (FerryBundle && typeof FerryBundle.shutdown === 'function') {
		FerryBundle.shutdown();
	}
	FerryBundle = null;
	FerryScope = null;
}

function uninstall(data, reason) {}
