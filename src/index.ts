/**
 * zotero-ferry — promote linked attachments to stored files for mobile reading,
 * then ferry them back to their original linked paths.
 *
 * This is the IIFE entry bundled to build/main.js and loaded by bootstrap.js.
 */
import './types';
import { registerMenu, unregisterMenu } from './ui';
import { promoteOne, promoteMany } from './promote';
import { revertOne, revertMany } from './revert';
import {
	DEFAULT_ORIGIN_PREFIX,
	DEFAULT_STORED_TAG,
	getOrigin,
	isPromoted,
	originPrefix,
	storedTag,
} from './memory';
import {
	BASE_PLACEHOLDER,
	STORAGE_PREFIX,
	getBaseDir,
	resolveFilePath,
	toRelativeForm,
	toAbsolutePath,
} from './paths';

export interface FerryApi {
	init(data: { id: string; rootURI: string | { spec: string } }): Promise<void>;
	shutdown(): void;
	promoteOne: typeof promoteOne;
	promoteMany: typeof promoteMany;
	revertOne: typeof revertOne;
	revertMany: typeof revertMany;
	getOrigin: typeof getOrigin;
	isPromoted: typeof isPromoted;
	storedTag: typeof storedTag;
	originPrefix: typeof originPrefix;
	DEFAULT_STORED_TAG: string;
	DEFAULT_ORIGIN_PREFIX: string;
	BASE_PLACEHOLDER: string;
	STORAGE_PREFIX: string;
	getBaseDir: typeof getBaseDir;
	resolveFilePath: typeof resolveFilePath;
	toRelativeForm: typeof toRelativeForm;
	toAbsolutePath: typeof toAbsolutePath;
}

const api: FerryApi = {
	async init(data) {
		await Zotero.initializationPromise;
		await Zotero.PreferencePanes.register({
			id: 'zotero-ferry-preferences',
			pluginID: data.id,
			src: 'prefs.xhtml',
			label: 'Zotero Ferry',
		});
		registerMenu();
		Zotero.debug('zotero-ferry: ready');
	},
	shutdown() {
		unregisterMenu();
		Zotero.PreferencePanes.unregister('zotero-ferry-preferences');
	},
	promoteOne,
	promoteMany,
	revertOne,
	revertMany,
	getOrigin,
	isPromoted,
	storedTag,
	originPrefix,
	DEFAULT_STORED_TAG,
	DEFAULT_ORIGIN_PREFIX,
	BASE_PLACEHOLDER,
	STORAGE_PREFIX,
	getBaseDir,
	resolveFilePath,
	toRelativeForm,
	toAbsolutePath,
};

export default api;
