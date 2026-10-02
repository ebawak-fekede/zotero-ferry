/**
 * Origin memory.
 *
 * Promoting an attachment to a stored file overwrites its `attachmentPath` with
 * `storage:<filename>`, so the original linked location has to be recorded
 * somewhere that survives a sync. Attachment items only carry `title`, `url` and
 * `accessDate`, so there is no `extra` field to stash it in — tags are used
 * instead. They sync with the library data and work on every machine.
 *
 * Two tags are written per promoted item:
 *   - a status tag          (default `Stored`)      — human-facing, what you filter on
 *   - an origin tag         (default `ferry-origin:`) — holds the portable path
 */

export const DEFAULT_STORED_TAG = 'Stored';
export const DEFAULT_ORIGIN_PREFIX = 'ferry-origin:';

export function encodeOriginTag(relOrAbs: string, prefix = DEFAULT_ORIGIN_PREFIX): string {
	return prefix + relOrAbs;
}

/** Returns null when the tag is not an origin tag. */
export function decodeOriginTag(tag: string, prefix = DEFAULT_ORIGIN_PREFIX): string | null {
	if (typeof tag !== 'string' || !tag.startsWith(prefix)) return null;
	const value = tag.slice(prefix.length);
	return value.length ? value : null;
}

export function findOriginTag(tags: string[], prefix = DEFAULT_ORIGIN_PREFIX): string | null {
	for (const tag of tags) {
		if (decodeOriginTag(tag, prefix) !== null) return tag;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Zotero-aware wrappers
// ---------------------------------------------------------------------------

function tagNames(item: any): string[] {
	return (item.getTags?.() ?? []).map((t: any) => (typeof t === 'string' ? t : t.tag));
}

function addTag(item: any, tag: string) {
	if (!tag) return;
	item.addTag(tag);
}

function removeTag(item: any, tag: string) {
	if (tag) item.removeTag(tag);
}

export function readStoredPref(key: string, fallback: string): string {
	try {
		const value = Zotero.Prefs.get(key, true);
		return value ? String(value) : fallback;
	} catch {
		return fallback;
	}
}

export function storedTag(): string {
	return readStoredPref('extensions.zotero-ferry.storedTag', DEFAULT_STORED_TAG);
}

export function originPrefix(): string {
	return readStoredPref('extensions.zotero-ferry.originTagPrefix', DEFAULT_ORIGIN_PREFIX);
}

/** The portable origin currently recorded for an item, or null. */
export function getOrigin(item: any): string | null {
	const tag = findOriginTag(tagNames(item), originPrefix());
	return tag === null ? null : decodeOriginTag(tag, originPrefix());
}

/** Record the origin and mark the item as promoted. */
export function rememberOrigin(item: any, relOrAbs: string) {
	const prefix = originPrefix();
	// Replace any stale record first so a re-promote cannot accumulate tags.
	const existing = findOriginTag(tagNames(item), prefix);
	if (existing) removeTag(item, existing);
	addTag(item, encodeOriginTag(relOrAbs, prefix));
	addTag(item, storedTag());
}

/** Drop the origin record and the status tag. */
export function forgetOrigin(item: any) {
	const prefix = originPrefix();
	const existing = findOriginTag(tagNames(item), prefix);
	if (existing) removeTag(item, existing);
	removeTag(item, storedTag());
}

export function isPromoted(item: any): boolean {
	return tagNames(item).includes(storedTag());
}
