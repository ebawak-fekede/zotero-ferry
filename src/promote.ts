/**
 * Promote a linked attachment to a stored (imported) file.
 *
 * The Calibre original is never touched: the file is copied into Zotero's own
 * storage, the item flips to `storage:<filename>`, and the original linked path
 * is recorded in an origin tag so it can be restored later.
 */
import type { ZoteroAttachment } from './types';
import { getBaseDir, isWin, joinPath, normalizeSlashes, toRelativeForm, STORAGE_PREFIX } from './paths';
import { rememberOrigin } from './memory';

export interface OpResult {
	id: number;
	ok: boolean;
	skipped: boolean;
	message: string;
}

/** A stored-file attachment name may not contain a directory separator. */
function safeFilename(name: string): string {
	let cleaned = name;
	try {
		cleaned = Zotero.File.getValidFileName(name);
	} catch {
		cleaned = name.split(/[/\\]/).pop() ?? name;
	}
	return cleaned.replace(/[/\\]/g, '_');
}

async function ensureDir(dirPath: string): Promise<void> {
	try {
		await IOUtils.makeDirectory(dirPath, { createAncestors: true, ignoreExisting: true });
	} catch (e) {
		// Some builds throw instead of honouring ignoreExisting.
		if (!(await IOUtils.exists(dirPath))) throw e;
	}
}

export async function promoteOne(item: ZoteroAttachment, dryRun: boolean): Promise<OpResult> {
	const id = item.itemID;

	if (!item.isAttachment()) {
		return { id, ok: false, skipped: true, message: 'not an attachment' };
	}
	if (item.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_LINKED_FILE) {
		return {
			id,
			ok: false,
			skipped: true,
			message: `linkMode ${item.attachmentLinkMode} is not a linked file`,
		};
	}

	const baseDir = getBaseDir();
	const win = isWin();

	const srcPath = item.attachmentPath;
	if (!srcPath || !srcPath.startsWith('attachments:')) {
		return { id, ok: false, skipped: true, message: `unexpected path form: ${srcPath}` };
	}

	const abs = joinPath(baseDir ?? '', srcPath.slice('attachments:'.length), win);
	if (!baseDir) {
		return { id, ok: false, skipped: true, message: 'no linked-attachment base directory set' };
	}
	if (!(await IOUtils.exists(abs))) {
		return { id, ok: false, skipped: true, message: `source not on disk: ${abs}` };
	}

	// The portable form is computed from the *absolute* path so an already-relative
	// path is normalised the same way as an absolute one.
	const portable = toRelativeForm(baseDir, abs, win);
	const filename = safeFilename(srcPath.slice('attachments:'.length).split('/').pop() ?? 'file');

	if (dryRun) {
		return {
			id,
			ok: true,
			skipped: false,
			message: `would copy to ${STORAGE_PREFIX}${filename} and record ${portable}`,
		};
	}

	const storageDir = Zotero.Attachments.getStorageDirectory(item);
	await ensureDir(storageDir.path);
	const destPath = joinPath(storageDir.path, filename, win);

	// Copy, never move — the Calibre copy stays exactly as it is on disk.
	await IOUtils.copy(normalizeSlashes(abs, win), normalizeSlashes(destPath, win));

	// Order matters: the attachmentPath setter reads linkMode to decide how to
	// interpret the value, and rejects `storage:` values for linked files.
	item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
	// Passing the `storage:`-prefixed name skips the setter's PathUtils branch.
	item.attachmentPath = STORAGE_PREFIX + filename;

	rememberOrigin(item, portable);
	await item.saveTx();

	return { id, ok: true, skipped: false, message: `stored as ${STORAGE_PREFIX}${filename}` };
}

export async function promoteMany(
	items: ZoteroAttachment[],
	opts: { dryRun: boolean }
): Promise<OpResult[]> {
	const results: OpResult[] = [];
	for (const item of items) {
		try {
			results.push(await promoteOne(item, opts.dryRun));
		} catch (e) {
			results.push({ id: item.itemID, ok: false, skipped: false, message: `error: ${e}` });
		}
	}
	return results;
}
