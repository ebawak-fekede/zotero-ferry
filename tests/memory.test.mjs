import test from 'node:test';
import assert from 'node:assert/strict';
import {
	DEFAULT_ORIGIN_PREFIX,
	DEFAULT_STORED_TAG,
	decodeOriginTag,
	encodeOriginTag,
	findOriginTag,
} from '../build/memory.mjs';

test('encode/decode round-trips a relative origin', () => {
	const tag = encodeOriginTag('attachments:Calibre Library/Mark Burgess/book.pdf');
	assert.equal(tag, 'ferry-origin:attachments:Calibre Library/Mark Burgess/book.pdf');
	assert.equal(decodeOriginTag(tag), 'attachments:Calibre Library/Mark Burgess/book.pdf');
});

test('encode/decode round-trips an out-of-base absolute origin', () => {
	const tag = encodeOriginTag('/run/user/1000/doc/abc/x.pdf');
	assert.equal(decodeOriginTag(tag), '/run/user/1000/doc/abc/x.pdf');
});

test('decode rejects non-origin tags', () => {
	assert.equal(decodeOriginTag('Stored'), null);
	assert.equal(decodeOriginTag(''), null);
	assert.equal(decodeOriginTag('ferry-origin:'), null);
});

test('decode honours a custom prefix', () => {
	const tag = encodeOriginTag('attachments:x.pdf', 'zz:');
	assert.equal(tag, 'zz:attachments:x.pdf');
	assert.equal(decodeOriginTag(tag, 'zz:'), 'attachments:x.pdf');
	assert.equal(decodeOriginTag(tag), null);
});

test('findOriginTag picks the first origin tag out of a list', () => {
	const tags = ['Stored', 'some tag', 'ferry-origin:attachments:a.pdf', 'ferry-origin:attachments:b.pdf'];
	assert.equal(findOriginTag(tags), 'ferry-origin:attachments:a.pdf');
});

test('findOriginTag returns null when there is none', () => {
	assert.equal(findOriginTag(['Stored', 'Other']), null);
	assert.equal(findOriginTag([]), null);
});

test('defaults match what the plugin writes', () => {
	assert.equal(DEFAULT_STORED_TAG, 'Stored');
	assert.equal(DEFAULT_ORIGIN_PREFIX, 'ferry-origin:');
});

test('origin with parentheses and spaces survives (Calibre folder names)', () => {
	const rel = 'attachments:Calibre Library/Donald Hearn/Computer Graphics, C Version - 2nd (186)/Computer Graphics, C Version - - Donald Hearn.pdf';
	const tag = encodeOriginTag(rel);
	assert.equal(decodeOriginTag(tag), rel);
});
