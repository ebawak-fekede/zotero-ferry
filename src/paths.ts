/**
 * Path handling for linked attachments.
 *
 * The pure functions here take every OS-specific input as a parameter so they can
 * be unit-tested without a Zotero runtime. Thin wrappers at the bottom read the
 * real values from Zotero when the plugin is running.
 *
 * Why this file exists: the `attachmentPath` setter accepts a canonical
 * `attachments:<relative>` string and returns it verbatim (it early-returns on
 * BASE_PATH_PLACEHOLDER), so we can store the portable form without ever touching
 * PathUtils. That matters — PathUtils.join rejects base directories that are not
 * valid on the current platform, which is exactly the NS_ERROR_FILE_UNRECOGNIZED_PATH
 * failure that broke the first batch-relink attempt.
 */

export const BASE_PLACEHOLDER = 'attachments:';
export const STORAGE_PREFIX = 'storage:';

export function isPlaceholder(path: string): boolean {
	return typeof path === 'string' && path.startsWith(BASE_PLACEHOLDER);
}

export function stripPlaceholder(path: string): string {
	return isPlaceholder(path) ? path.slice(BASE_PLACEHOLDER.length) : path;
}

/** Forward slashes on POSIX, backslashes on Windows. Never touches PathUtils. */
export function normalizeSlashes(path: string, isWin: boolean): string {
	return isWin ? path.replace(/\//g, '\\') : path.replace(/\\/g, '/');
}

function trimTrailingSep(path: string): string {
	return path.replace(/[\\/]+$/, '');
}

export function joinPath(base: string, rel: string, isWin: boolean): string {
	return normalizeSlashes(trimTrailingSep(base) + '/' + rel, isWin);
}

/**
 * Express an absolute path as the portable `attachments:<relative>` form when it
 * lives under the linked-attachment base directory. Paths outside the base
 * directory are returned unchanged (they cannot be made portable).
 */
export function toRelativeForm(baseDir: string, absPath: string, isWin: boolean): string {
	if (!baseDir || !absPath) return absPath;
	const base = normalizeSlashes(trimTrailingSep(baseDir), isWin);
	const abs = normalizeSlashes(absPath, isWin);
	const prefix = base + (isWin ? '\\' : '/');
	if (abs.toLowerCase().startsWith(prefix.toLowerCase())) {
		return BASE_PLACEHOLDER + abs.slice(prefix.length);
	}
	return absPath;
}

/**
 * Turn whatever we have on record into an absolute path.
 * - `attachments:foo` -> `<baseDir>/foo`
 * - anything else      -> returned unchanged (already absolute)
 *
 * Returns false when a relative path cannot be resolved (no base directory set).
 */
export function toAbsolutePath(baseDir: string, relOrAbs: string, isWin: boolean): string | false {
	if (!relOrAbs) return false;
	if (!isPlaceholder(relOrAbs)) return relOrAbs;
	if (!baseDir) return false;
	return joinPath(baseDir, stripPlaceholder(relOrAbs), isWin);
}

/** Filename of any path form (`storage:` / `attachments:` / absolute). */
export function filenameOf(path: string): string {
	if (!path) return '';
	if (isPlaceholder(path) || path.startsWith(STORAGE_PREFIX)) {
		return stripPlaceholder(path).replace(STORAGE_PREFIX, '').split('/').pop() || '';
	}
	return normalizeSlashes(path, false).split('/').pop() || '';
}

// ---------------------------------------------------------------------------
// Zotero-aware wrappers
// ---------------------------------------------------------------------------

export function isWin(): boolean {
	return typeof Zotero !== 'undefined' && !!Zotero.isWin;
}

export function getBaseDir(): string | null {
	try {
		const value = Zotero.Prefs.get('baseAttachmentPath');
		return value ? String(value) : null;
	} catch {
		return null;
	}
}

/**
 * Absolute path of the file a linked or stored attachment points at, without
 * going through PathUtils. Returns false when it cannot be resolved.
 */
export function resolveFilePath(item: any, baseDir = getBaseDir()): string | false {
	const raw = item?.attachmentPath;
	if (!raw) return false;
	const win = isWin();

	if (raw.startsWith(STORAGE_PREFIX)) {
		const dir = Zotero.Attachments.getStorageDirectory(item);
		return joinPath(dir.path, raw.slice(STORAGE_PREFIX.length), win);
	}
	return toAbsolutePath(baseDir ?? '', raw, win);
}
