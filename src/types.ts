/**
 * Minimal ambient declarations for the Zotero 10 script scope.
 *
 * These cover only what zotero-ferry actually calls. They are intentionally
 * narrow — the point is type safety around our own logic, not a full re-typing
 * of the Zotero API.
 */

export interface ZoteroAttachment {
	readonly itemID: number;
	readonly key: string;
	readonly libraryID: number;
	attachmentLinkMode: number | string;
	attachmentPath: string;
	attachmentFilename: string;
	isAttachment(): boolean;
	getTags(): Array<{ tag: string } | string>;
	addTag(tag: string): boolean;
	removeTag(tag: string): boolean;
	saveTx(): Promise<number | void>;
}

export interface ZoteroGlobal {
	readonly isWin: boolean;
	readonly initializationPromise: Promise<void>;
	debug(message: string, level?: number): void;
	PreferencePanes: {
		register(options: { id: string; pluginID: string; src: string; label: string }): Promise<string>;
		unregister(id: string): void;
	};
	Prefs: {
		get(key: string, global?: boolean): string | number | boolean | undefined;
		set(key: string, value: string | number | boolean, global?: boolean): void;
	};
	Items: {
		get(id: number | number[]): ZoteroAttachment | ZoteroAttachment[] | false;
	};
	Attachments: {
		readonly BASE_PATH_PLACEHOLDER: string;
		readonly LINK_MODE_IMPORTED_FILE: number;
		readonly LINK_MODE_IMPORTED_URL: number;
		readonly LINK_MODE_LINKED_FILE: number;
		readonly LINK_MODE_LINKED_URL: number;
		readonly LINK_MODE_EMBEDDED_IMAGE: number;
		getStorageDirectory(item: ZoteroAttachment): { path: string };
		getBaseDirectoryRelativePath(path: string): string;
		resolveRelativePath(path: string): string | false;
	};
	File: {
		getValidFileName(name: string): string;
		copyFile(src: string, dest: string): Promise<void>;
	};
}

export interface ServicesGlobal {
	scriptloader: {
		loadSubScript(url: string, target?: unknown): void;
	};
	wm: {
		getEnumerator(type: string): {
			hasMoreElements(): boolean;
			getNext(): { document: Document };
		};
	};
}

declare global {
	// eslint-disable-next-line no-var
	var Zotero: ZoteroGlobal;
	// eslint-disable-next-line no-var
	var Services: ServicesGlobal;
	// eslint-disable-next-line no-var
	var IOUtils: {
		exists(path: string): Promise<boolean>;
		copy(src: string, dest: string, options?: Record<string, unknown>): Promise<void>;
		makeDirectory(path: string, options?: Record<string, unknown>): Promise<void>;
		remove(path: string, options?: Record<string, unknown>): Promise<void>;
		writeUTF8(path: string, data: string): Promise<void>;
	};
}
