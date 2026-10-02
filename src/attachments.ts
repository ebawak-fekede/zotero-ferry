export type Target = "stored" | "linked";
export type Result = { id: number; ok: boolean; skipped: boolean; message: string; newID?: number };

const ORIGIN = "ferry-origin:";
const STORED = "Stored";

/** Read the linked path recorded on an attachment, including tags from older releases. */
export function getOrigin(item: Zotero.Item): string | undefined {
  return item
    .getTags()
    .find((tag) => tag.tag.startsWith(ORIGIN))
    ?.tag.slice(ORIGIN.length);
}

/** Require a usable local file before starting any conversion. */
async function existingFile(path: string | false): Promise<string> {
  if (!path) throw new Error("Set the Linked Attachment Base Directory on this computer.");
  if (!(await IOUtils.exists(path))) throw new Error(`File not found: ${path}`);
  return path;
}

/** Resolve portable origins with Zotero's own platform-aware path handling. */
async function resolveOrigin(origin: string): Promise<string> {
  return existingFile(
    origin.startsWith("attachments:") ? Zotero.Attachments.resolveRelativePath(origin) : origin,
  );
}

/**
 * Zotero's server makes linkMode immutable for an existing attachment key.
 * Create the destination through Zotero's file API, transfer its children, then
 * erase the old record so sync uploads a creation and deletion instead.
 */
export async function replaceAttachment(
  item: Zotero.Item,
  target: Target,
  file: string,
): Promise<Zotero.Item> {
  const annotations = item.getAnnotations(true);
  // Create the new record in its final mode and prepare its file first.
  const create =
    target === "stored"
      ? Zotero.Attachments.importFromFile.bind(Zotero.Attachments)
      : Zotero.Attachments.linkFromFile.bind(Zotero.Attachments);
  const replacement = await create({
    file,
    libraryID: item.libraryID,
    parentItemID: item.parentItemID || undefined,
    title: item.getField("title"),
    contentType: item.attachmentContentType,
  });
  let backup: string | undefined;
  const oldDirectory = Zotero.Attachments.getStorageDirectory(item).path;
  try {
    await Zotero.DB.executeTransaction(async () => {
      // Copy metadata while keeping the replacement's own identity.
      // Keep bibliographic data and tags, but never reuse the old identity or
      // cloud-file hash. The destination already has its own key and file.
      const metadata = item.toJSON() as Record<string, unknown>;
      delete metadata.key;
      delete metadata.version;
      delete metadata.md5;
      delete metadata.mtime;
      delete metadata.filename;
      delete metadata.path;
      metadata.linkMode = target === "stored" ? "imported_file" : "linked_file";
      if (target === "stored") metadata.filename = replacement.attachmentFilename;
      else metadata.path = Zotero.Attachments.getBaseDirectoryRelativePath(file);
      replacement.fromJSON(metadata);

      // Update Ferry's path record and status tag.
      if (target === "stored") {
        const origin = getOrigin(item) || Zotero.Attachments.getBaseDirectoryRelativePath(file);
        for (const tag of replacement.getTags()) {
          if (tag.tag.startsWith(ORIGIN)) replacement.removeTag(tag.tag);
        }
        replacement.addTag(ORIGIN + origin);
        replacement.addTag(STORED);
      } else {
        for (const tag of replacement.getTags()) {
          if (tag.tag === STORED || tag.tag.startsWith(ORIGIN)) replacement.removeTag(tag.tag);
        }
      }
      await replacement.save();

      // Transfer children and references before deleting the source.
      // Move every annotation, including trashed and PDF-imported annotations.
      // Their keys stay stable; only the parent attachment changes.
      for (const annotation of annotations) {
        annotation.parentItemID = replacement.id;
        await annotation.save({ skipEditCheck: true });
      }
      await Zotero.Relations.copyObjectSubjectRelations(item, replacement);
      await Zotero.Fulltext.transferItemIndex(item, replacement);

      // Erasing a stored item deletes its directory immediately. Hold it aside
      // until the database commits so a failed conversion can restore it.
      if (item.isStoredFileAttachment() && (await IOUtils.exists(oldDirectory))) {
        const temporary = oldDirectory + "-ferry-backup";
        if (await IOUtils.exists(temporary))
          throw new Error(`Conversion backup already exists: ${temporary}`);
        await IOUtils.move(oldDirectory, temporary, { noOverwrite: true });
        backup = temporary;
      }
      await item.erase();
    });
  } catch (error) {
    // Restore the original file after a database rollback.
    if (backup) await IOUtils.move(backup, oldDirectory, { noOverwrite: true });
    // Saved child objects may still cache the rolled-back parent in memory.
    for (const id of [item.id, ...annotations.map((annotation) => annotation.id)]) {
      await Zotero.Items.reload(id, ["primaryData", "childItems"], true);
    }
    await replacement.eraseTx();
    throw error;
  }

  // The conversion committed; the old stored copy can now be discarded.
  if (backup) {
    try {
      await IOUtils.remove(backup, { recursive: true, ignoreAbsent: true });
    } catch (error) {
      Zotero.logError(error as Error);
    }
  }
  return replacement;
}

/** Convert an eligible attachment, or report why it was left alone. Preview writes nothing. */
export async function convert(item: Zotero.Item, target: Target, preview = false): Promise<Result> {
  // Check eligibility and the remembered path.
  const id = item.id;
  const skip = (message: string): Result => ({ id, ok: false, skipped: true, message });
  if (!item.isAttachment() || item.libraryID !== Zotero.Libraries.userLibraryID) {
    return skip("Select an attachment in My Library.");
  }
  if (item.attachmentLinkMode !== (target === "stored" ? 2 : 0))
    return skip("Already in that mode.");
  const origin = getOrigin(item);
  if (target === "linked" && !origin) return skip("No original linked path was recorded.");

  // Resolve the file through Zotero before making any changes.
  let file: string;
  try {
    file =
      target === "stored"
        ? await existingFile(await item.getFilePathAsync())
        : await resolveOrigin(origin!);
  } catch (error) {
    return skip(String(error));
  }
  if (preview)
    return { id, ok: true, skipped: false, message: `Would convert to ${target}: ${file}` };

  // Convert and keep one outcome for the batch report.
  try {
    const replacement = await replaceAttachment(item, target, file);
    return {
      id,
      newID: replacement.id,
      ok: true,
      skipped: false,
      message: `Converted to ${target}.`,
    };
  } catch (error) {
    Zotero.logError(error as Error);
    return { id, ok: false, skipped: false, message: String(error) };
  }
}

/** Process a selection one attachment at a time and retain every outcome. */
export async function convertMany(items: Zotero.Item[], target: Target): Promise<Result[]> {
  const results: Result[] = [];
  for (const item of items) results.push(await convert(item, target));
  return results;
}
