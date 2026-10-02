/**
 * Item-pane context menu and result reporting.
 *
 * Zotero 7 loads plugins as bootstrapped extensions, so the menu is attached to
 * the live `#zotero-itemmenu` node and removed again on shutdown.
 */
import type { ZoteroAttachment } from './types';
import { promoteMany } from './promote';
import { revertMany, isStoredFile } from './revert';
import type { OpResult } from './promote';
import { isPlaceholder } from './paths';

const MENU_ID = 'zotero-ferry-menu';
const PROMOTE_ID = 'zotero-ferry-promote';
const REVERT_ID = 'zotero-ferry-revert';

let popupListener: ((e: Event) => void) | null = null;

function mainWindow(): Document | null {
	try {
		const pane = (Zotero as unknown as { getActiveZoteroPane?: () => { document: Document } })
			.getActiveZoteroPane?.();
		if (pane?.document) return pane.document;
	} catch {
		/* fall through */
	}
	const en = Services.wm.getEnumerator('navigator:browser');
	return en.hasMoreElements() ? en.getNext().document : null;
}

function prefBool(key: string, fallback: boolean): boolean {
	try {
		const v = Zotero.Prefs.get(key);
		return typeof v === 'boolean' ? v : v === 'true';
	} catch {
		return fallback;
	}
}

function prefString(key: string, fallback: string): string {
	try {
		const v = Zotero.Prefs.get(key);
		return v ? String(v) : fallback;
	} catch {
		return fallback;
	}
}

/**
 * Expand a selection down to its attachments. Selecting a parent item promotes
 * every linked attachment beneath it, which is what you actually want when a
 * book has several files.
 */
function collectSelected(action: 'promote' | 'revert'): ZoteroAttachment[] {
	const pane = (Zotero as unknown as {
		getActiveZoteroPane?: () => { getSelectedItems: () => any[] };
	}).getActiveZoteroPane?.();
	const selected = pane?.getSelectedItems?.() ?? [];
	const out: ZoteroAttachment[] = [];
	const seen = new Set<number>();

	const wantLinked = action === 'promote';
	const wantMode = wantLinked
		? Zotero.Attachments.LINK_MODE_LINKED_FILE
		: Zotero.Attachments.LINK_MODE_IMPORTED_FILE;

	const consider = (item: any) => {
		if (!item || seen.has(item.itemID)) return;
		seen.add(item.itemID);
		if (item.isAttachment?.()) {
			if (item.attachmentLinkMode === wantMode) out.push(item as ZoteroAttachment);
			return;
		}
		for (const id of item.getAttachments?.() ?? []) {
			const child = Zotero.Items.get(id);
			if (child) consider(child);
		}
	};

	for (const item of selected) consider(item);
	return out;
}

function confirmAction(action: 'promote' | 'revert', count: number): boolean {
	if (!prefBool(action === 'promote' ? 'extensions.zotero-ferry.confirmPromote' : 'extensions.zotero-ferry.confirmRevert', true)) {
		return true;
	}
	const doc = mainWindow();
	const prompt = (doc?.defaultView as any)?.Services?.prompt ?? (Services as any).prompt;
	const title = action === 'promote' ? 'Zotero Ferry — Make available on mobile' : 'Zotero Ferry — Return to linked';
	const text =
		action === 'promote'
			? `Promote ${count} linked attachment${count === 1 ? '' : 's'} to stored files?\n\n` +
			  'The original linked file is left untouched on disk, so nothing is lost if you undo this.'
			: `Return ${count} stored attachment${count === 1 ? '' : 's'} to their original linked paths?\n\n` +
			  'The stored copy is deleted afterwards. Annotations stay in the Zotero database either way.';
	return prompt.confirm(doc?.defaultView ?? null, title, text);
}

function reportResults(action: 'promote' | 'revert', results: OpResult[], dryRun: boolean): void {
	const ok = results.filter((r) => r.ok).length;
	const skipped = results.filter((r) => r.skipped).length;
	const failed = results.filter((r) => !r.ok && !r.skipped).length;

	const lines = results
		.filter((r) => !r.ok || dryRun)
		.slice(0, 12)
		.map((r) => `#${r.id}: ${r.message}`);
	const tail = lines.length ? `\n\n${lines.join('\n')}` : '';

	const doc = mainWindow();
	const prompt = (doc?.defaultView as any)?.Services?.prompt ?? (Services as any).prompt;
	const heading =
		action === 'promote' ? 'Zotero Ferry — Make available on mobile' : 'Zotero Ferry — Return to linked';
	const summary = dryRun
		? `Dry run — nothing was written.\n\nWould succeed: ${ok}, skip: ${skipped}, fail: ${failed}${tail}`
		: `Finished: ${ok} succeeded, ${skipped} skipped, ${failed} failed${tail}`;
	prompt.alert(doc?.defaultView ?? null, heading, summary);
}

async function run(action: 'promote' | 'revert'): Promise<void> {
	const items = collectSelected(action);
	if (!items.length) {
		const doc = mainWindow();
		const prompt = (doc?.defaultView as any)?.Services?.prompt ?? (Services as any).prompt;
		prompt.alert(
			doc?.defaultView ?? null,
			'Zotero Ferry',
			action === 'promote'
				? 'No linked attachments in the selection.'
				: 'No stored attachments in the selection.'
		);
		return;
	}
	if (!confirmAction(action, items.length)) return;

	const dryRun = prefBool('extensions.zotero-ferry.dryRun', false);
	const results = await (action === 'promote'
		? promoteMany(items, { dryRun })
		: revertMany(items, { dryRun }));
	reportResults(action, results, dryRun);
}

function rebuildMenu(doc: Document): void {
	const menu = doc.getElementById('zotero-itemmenu');
	if (!menu) return;

	const promoteEligible = collectSelected('promote').length;
	const revertEligible = collectSelected('revert').length;

	const existing = doc.getElementById(MENU_ID);
	if (existing) existing.remove();
	if (!promoteEligible && !revertEligible) return;

	// `createXULElement` is a Gecko extension missing from the DOM lib types.
	const xul = (d: Document, name: string) =>
		(d as unknown as { createXULElement: (n: string) => Element }).createXULElement(name);

	const parent = xul(doc, 'menu');
	parent.id = MENU_ID;
	parent.setAttribute('label', 'Ferry');

	const popup = xul(doc, 'menupopup');

	const makeItem = (id: string, label: string, enabled: boolean, handler: () => void) => {
		const el = xul(doc, 'menuitem');
		el.id = id;
		el.setAttribute('label', label);
		if (!enabled) el.setAttribute('disabled', 'true');
		el.addEventListener('command', handler);
		popup.appendChild(el);
	};

	makeItem(PROMOTE_ID, 'Make available on mobile', promoteEligible > 0, () => void run('promote'));
	makeItem(REVERT_ID, 'Return to linked', revertEligible > 0, () => void run('revert'));

	parent.appendChild(popup);
	menu.appendChild(parent);
}

export function registerMenu(): void {
	const doc = mainWindow();
	if (!doc) return;

	popupListener = () => rebuildMenu(doc);
	const menu = doc.getElementById('zotero-itemmenu');
	menu?.addEventListener('popupshowing', popupListener);
}

export function unregisterMenu(): void {
	if (!popupListener) return;
	const doc = mainWindow();
	const menu = doc?.getElementById('zotero-itemmenu');
	menu?.removeEventListener('popupshowing', popupListener);
	doc?.getElementById(MENU_ID)?.remove();
	popupListener = null;
}

export { isPlaceholder, isStoredFile };
