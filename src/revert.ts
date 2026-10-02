/**
 * Return a stored (imported) attachment to its original linked path.
 *
 * The origin is read back out of the memory tag written at promote time and
 * resolved against the current linked-attachment base directory, so the round
 * trip works on any machine where the base directory is configured — the record
 * is portable, not an absolute path frozen at promote time.
 */
import type { ZoteroAttachment } from './types';
import {
	getBaseDir,
	isWin,
	joinPath,
	normalizeSlashes,
	resolveFilePath,
	toAbsolutePath,
	toRelativeForm,
	STORAGE_PREFIX,
} from './paths';
import { forgetOrigin, getOrigin } from './memory';
import type { OpResult } from './promote';

/**
 * Annotations are stored in the Zotero database and hang off the attachment item,
 * not the PDF, so they survive a link-mode change. They are only written into the
 * file by Zotero's opt-in "Save to PDF" action, which is not replicated here.
 */
export function annotationCount(item: ZoteroAttachment): number {
	try {
		const anyItem = item as unknown as { getAnnotations?: () => unknown[] };
		return anyItem.getAnnotations?.().length ?? 0;
	} catch {
		return 0;
	}
}

export async function revertOne(item: ZoteroAttachment, dryRun: boolean): Promise<OpResult> {
	const id = item.itemID;

	if (!item.isAttachment()) {
		return { id, ok: false, skipped: true, message: 'not an attachment' };
	}
	if (item.attachmentLinkMode !== Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
		return {
			id,
			ok: false,
			skipped: true,
			message: `linkMode ${item.attachmentLinkMode} is not a stored file`,
		};
	}

	const origin = getOrigin(item);
	if (origin === null) {
		return {
			id,
			ok: false,
			skipped: true,
			message: 'no origin recorded — cannot restore (was this promoted by Ferry?)',
		};
	}

	const baseDir = getBaseDir();
	const win = isWin();

	const abs = toAbsolutePath(baseDir ?? '', origin, win);
	if (!abs) {
		return {
			id,
			ok: false,
			skipped: true,
			message: `cannot resolve "${origin}" — set a linked-attachment base directory`,
		};
	}
	if (!(await IOUtils.exists(abs))) {
		return {
			id,
			ok: false,
			skipped: true,
			message: `origin not on disk: ${abs}`,
		};
	}

	const storagePath = resolveFilePath(item, baseDir ?? undefined);
	const notes = annotationCount(item);

	if (dryRun) {
		return {
			id,
			ok: true,
			skipped: false,
			message:
				`would restore to ${toRelativeForm(baseDir ?? '', abs, win)}` +
				(notes ? ` (${notes} annotations stay in the database)` : ''),
		};
	}

	// Flip to linked first, then point at the original file. The setter is given
	// the ABSOLUTE path on purpose: the linked branch either relativises it (when
	// `saveRelativeAttachmentPath` is on) or leaves it as-is. Neither touches
	// PathUtils for a non-placeholder value, which avoids
	// NS_ERROR_FILE_UNRECOGNIZED_PATH on platforms where the base directory
	// string is not one PathUtils understands.
	item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_LINKED_FILE;
	item.attachmentPath = normalizeSlashes(abs, win);

	forgetOrigin(item);
	await item.saveTx();

	// Only now is it safe to drop the stored copy — the item no longer points at it.
	if (storagePath) {
		const dir = normalizeSlashes(storagePath, win).split(/[/\\]/).slice(0, -1).join(win ? '\\' : '/');
		try {
			await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true, ignorePermissions: true });
		} catch (e) {
			return {
				id,
				ok: true,
				skipped: false,
				message: `restored to ${toRelativeForm(baseDir ?? '', abs, win)} (stored copy not removed: ${e})`,
			};
		}
	}

	return {
		id,
		ok: true,
		skipped: false,
		message:
			`linked to ${toRelativeForm(baseDir ?? '', abs, win)}` +
			(notes ? ` (${notes} annotations kept in the database)` : ''),
	};
}

export async function revertMany(
	items: ZoteroAttachment[],
	opts: { dryRun: boolean }
): Promise<OpResult[]> {
	const results: OpResult[] = [];
	for (const item of items) {
		try {
			results.push(await revertOne(item, opts.dryRun));
		} catch (e) {
			results.push({ id: item.itemID, ok: false, skipped: false, message: `error: ${e}` });
		}
	}
	return results;
}

/** Used by the preview dialog: true when an item is currently promoted. */
export function isStoredFile(item: ZoteroAttachment): boolean {
	return item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
}

export { STORAGE_PREFIX };
