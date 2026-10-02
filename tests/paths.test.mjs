import test from 'node:test';
import assert from 'node:assert/strict';
import {
	BASE_PLACEHOLDER,
	STORAGE_PREFIX,
	filenameOf,
	isPlaceholder,
	joinPath,
	normalizeSlashes,
	stripPlaceholder,
	toAbsolutePath,
	toRelativeForm,
} from '../build/paths.mjs';

const BASE = '/mnt/windows-yoga/Users/25191/Zotero linked files';

test('placeholder detection', () => {
	assert.equal(isPlaceholder('attachments:foo.pdf'), true);
	assert.equal(isPlaceholder('storage:foo.pdf'), false);
	assert.equal(isPlaceholder('/abs/foo.pdf'), false);
	assert.equal(isPlaceholder(''), false);
	assert.equal(BASE_PLACEHOLDER, 'attachments:');
});

test('stripPlaceholder', () => {
	assert.equal(stripPlaceholder('attachments:Calibre Library/x.pdf'), 'Calibre Library/x.pdf');
	assert.equal(stripPlaceholder('/abs/x.pdf'), '/abs/x.pdf');
});

test('normalizeSlashes is platform-aware', () => {
	assert.equal(normalizeSlashes('a/b\\c', false), 'a/b/c');
	assert.equal(normalizeSlashes('a/b\\c', true), 'a\\b\\c');
});

test('joinPath trims trailing separators from the base', () => {
	assert.equal(joinPath(BASE + '/', 'Calibre Library/x.pdf', false), BASE + '/Calibre Library/x.pdf');
	assert.equal(joinPath(BASE + '///', 'x.pdf', false), BASE + '/x.pdf');
});

test('joinPath respects Windows separators', () => {
	assert.equal(joinPath('C:\\Users\\me\\linked', 'Calibre/x.pdf', true), 'C:\\Users\\me\\linked\\Calibre\\x.pdf');
});

test('toRelativeForm rewrites paths under the base dir', () => {
	assert.equal(
		toRelativeForm(BASE, BASE + '/Calibre Library/Mark Burgess/book.pdf', false),
		'attachments:Calibre Library/Mark Burgess/book.pdf'
	);
});

test('toRelativeForm is case-insensitive on the prefix (NTFS mount)', () => {
	assert.equal(
		toRelativeForm(BASE, BASE.toUpperCase() + '/Calibre Library/book.pdf', false),
		'attachments:Calibre Library/book.pdf'
	);
});

test('toRelativeForm leaves out-of-base paths alone', () => {
	assert.equal(
		toRelativeForm(BASE, '/somewhere/else/book.pdf', false),
		'/somewhere/else/book.pdf'
	);
});

test('toRelativeForm is idempotent on already-relative values', () => {
	// Passing an absolute path derived from the relative form round-trips.
	const rel = toRelativeForm(BASE, BASE + '/x.pdf', false);
	assert.equal(rel, 'attachments:x.pdf');
});

test('toAbsolutePath resolves the portable form', () => {
	assert.equal(
		toAbsolutePath(BASE, 'attachments:Calibre Library/book.pdf', false),
		BASE + '/Calibre Library/book.pdf'
	);
});

test('toAbsolutePath passes absolute values through', () => {
	assert.equal(toAbsolutePath(BASE, '/run/user/1000/doc/abc/x.pdf', false), '/run/user/1000/doc/abc/x.pdf');
});

test('toAbsolutePath returns false when it cannot resolve', () => {
	assert.equal(toAbsolutePath('', 'attachments:x.pdf', false), false);
	assert.equal(toAbsolutePath(BASE, '', false), false);
});

test('filenameOf handles every path form', () => {
	assert.equal(filenameOf('storage:Book - Author.pdf'), 'Book - Author.pdf');
	assert.equal(filenameOf('attachments:Calibre Library/a/Book.pdf'), 'Book.pdf');
	assert.equal(filenameOf('/abs/dir/Book.pdf'), 'Book.pdf');
	assert.equal(filenameOf('C:\\dir\\Book.pdf'), 'Book.pdf');
	assert.equal(filenameOf(''), '');
});

test('STORAGE_PREFIX is what the setter expects', () => {
	assert.equal(STORAGE_PREFIX, 'storage:');
});
