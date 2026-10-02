/**
 * Optional Calibre integration.
 *
 * Your library lives at `Zotero linked files/Calibre Library/<Author>/<Title> (<id>)/<file>`,
 * which makes the on-disk path fully derivable from a Calibre book id. This module
 * resolves that path so Ferry can create a linked attachment pointing straight at
 * the Calibre file instead of you typing the path by hand.
 *
 * Deliberately filesystem-only — no SQLite, no PathUtils, no process spawning.
 */
import { joinPath, isWin } from './paths';

export interface CalibreBook {
	/** Calibre book id, e.g. 173. */
	id: number;
	/** Path relative to the linked-attachment base directory. */
	relative: string;
	/** Absolute path to the book's primary file. */
	absolute: string;
	filename: string;
}

const BOOK_EXT = /\.(pdf|epub|mobi|azw3?|djvu|txt|html?|docx?|rtf)$/i;

/** Find a book folder whose name ends in `(<id>)`, e.g. `.../Title (173)`. */
export function findByBookId(libraryRoot: string, bookId: number, entries: string[]): string | null {
	const suffix = `(${bookId})`;
	for (const name of entries) {
		if (name.endsWith(suffix)) return name;
	}
	return null;
}

/** Pick the primary file for a book folder from a listing of its filenames. */
export function primaryFile(files: string[]): string | null {
	const candidates = files.filter((f) => BOOK_EXT.test(f));
	if (!candidates.length) return null;
	// PDF beats EPUB beats everything else, matching how Calibre reports the
	// "main" format when a book has several.
	const rank = (f: string) => (f.toLowerCase().endsWith('.pdf') ? 0 : f.toLowerCase().endsWith('.epub') ? 1 : 2);
	return candidates.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0];
}

/**
 * Build the target for a Calibre book without touching the filesystem.
 * `relDir` is the book folder relative to the linked-attachment base directory.
 */
export function buildTarget(relDir: string, filename: string, baseDir: string): CalibreBook {
	const idMatch = relDir.match(/\((\d+)\)\/?$/);
	const id = idMatch ? Number(idMatch[1]) : -1;
	const relative = `${relDir.replace(/\/$/, '')}/${filename}`;
	return {
		id,
		relative,
		absolute: joinPath(baseDir, relative, isWin()),
		filename,
	};
}

export { joinPath };
