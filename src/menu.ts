import { convertMany, getOrigin, type Target } from "./attachments";

const menus = new Map<Document, EventListener>();
type MainWindow = ReturnType<typeof Zotero.getMainWindow>;

/** Expand parent items, filter eligible attachments, and avoid processing duplicates. */
function selected(window: MainWindow, target: Target): Zotero.Item[] {
  // Expand parent items and deduplicate attachments selected both ways.
  const items = new Map<number, Zotero.Item>();
  for (const item of window.ZoteroPane.getSelectedItems()) {
    const attachments = item.isAttachment()
      ? [item]
      : (item.getAttachments?.() || []).map((id: number) => Zotero.Items.get(id));
    for (const attachment of attachments) {
      if (
        attachment &&
        attachment.attachmentLinkMode === (target === "stored" ? 2 : 0) &&
        (target === "stored" || getOrigin(attachment))
      )
        items.set(attachment.id, attachment);
    }
  }
  return [...items.values()];
}

/** Run the menu command and select the replacement attachments when it finishes. */
async function run(window: MainWindow, target: Target): Promise<void> {
  const results = await convertMany(selected(window, target), target);
  const changed = results.filter((result) => result.ok);
  if (changed.length) await window.ZoteroPane.selectItems(changed.map((result) => result.newID!));
  const skipped = results.filter((result) => result.skipped).length;
  const failures = results.filter((result) => !result.ok && !result.skipped);
  const details = results
    .filter((result) => !result.ok)
    .map((result) => `#${result.id}: ${result.message}`);
  Zotero.alert(
    window as unknown as Window,
    "Zotero Ferry",
    `${changed.length} converted, ${skipped} skipped, ${failures.length} failed.` +
      (details.length ? "\n\n" + details.join("\n") : ""),
  );
}

/** Add Ferry to one Zotero window's attachment context menu. */
export function registerWindow(window: MainWindow): void {
  // Attach once to this window's context menu.
  const document: Document = window.document;
  const popup = document.getElementById("zotero-itemmenu");
  if (!popup || menus.has(document)) return;
  const listener = (event: Event) => {
    // Submenu events bubble through here; rebuilding on them closes the menu.
    if (event.target !== popup) return;

    // Rebuild from the current selection when the root menu opens.
    document.getElementById("zotero-ferry-menu")?.remove();
    const stored = selected(window, "stored");
    const linked = selected(window, "linked");
    if (!stored.length && !linked.length) return;
    const create = (name: string) => window.document.createXULElement(name);
    const menu = create("menu");
    menu.id = "zotero-ferry-menu";
    menu.setAttribute("label", "Ferry");
    const submenu = create("menupopup");

    // Bind both commands, enabling only the eligible direction.
    for (const [target, label, count] of [
      ["stored", "Convert to stored attachment", stored.length],
      ["linked", "Return to linked", linked.length],
    ] as const) {
      const entry = create("menuitem");
      entry.id = `zotero-ferry-${target}`;
      entry.setAttribute("label", label);
      entry.setAttribute("disabled", String(!count));
      entry.addEventListener("command", () => {
        void run(window, target).catch((error) => {
          Zotero.logError(error as Error);
          Zotero.alert(window as unknown as Window, "Zotero Ferry", String(error));
        });
      });
      submenu.appendChild(entry);
    }
    menu.appendChild(submenu);
    popup.appendChild(menu);
  };
  popup.addEventListener("popupshowing", listener);
  menus.set(document, listener);
}

/** Remove the menu and its event listener when a window closes. */
export function unregisterWindow(window: MainWindow): void {
  const document: Document = window.document;
  const listener = menus.get(document);
  if (listener)
    document.getElementById("zotero-itemmenu")?.removeEventListener("popupshowing", listener);
  document.getElementById("zotero-ferry-menu")?.remove();
  menus.delete(document);
}

/** Remove all window listeners when Zotero disables or upgrades the plugin. */
export function unregisterMenus(): void {
  for (const document of menus.keys())
    unregisterWindow(document.defaultView as unknown as MainWindow);
}
