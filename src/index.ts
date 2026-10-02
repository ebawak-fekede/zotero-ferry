import { convert, convertMany, getOrigin, replaceAttachment } from "./attachments";
import { registerWindow, unregisterWindow, unregisterMenus } from "./menu";

export default {
  /** Attach menus to windows that already exist when the plugin starts. */
  async init() {
    await Zotero.initializationPromise;
    for (const window of Zotero.getMainWindows()) registerWindow(window);
    Zotero.debug("zotero-ferry: ready");
  },
  shutdown: unregisterMenus,
  registerWindow,
  unregisterWindow,
  convert,
  convertMany,
  getOrigin,
  replaceAttachment,
};
