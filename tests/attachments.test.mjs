import test from "node:test";
import assert from "node:assert/strict";
import { convert, replaceAttachment, getOrigin } from "../build/attachments.mjs";

// Model the server's immutable attachment mode and a transactional local store.
// Tests check data preservation and upload identities, not filename construction.
function fixture(mode = 2) {
  let sequence = 1;
  let failure;
  const records = new Map();
  const deleted = [];
  const files = new Map([["/linked/book.pdf", "canonical PDF"]]);
  const children = [
    {
      id: 100,
      key: "ANNOTATION",
      parentItemID: 1,
      persistedParentItemID: 1,
      async save() {
        this.persistedParentItemID = this.parentItemID;
      },
    },
  ];

  class Item {
    constructor(linkMode, path) {
      this.id = sequence++;
      this.key = `KEY${this.id}`;
      this.version = this.id === 1 ? 20017 : 0;
      this.libraryID = 1;
      this.parentItemID = 9;
      this.mode = linkMode;
      this.attachmentPath = path;
      this.tags = [];
      records.set(this.id, this);
    }
    get attachmentLinkMode() {
      return this.mode;
    }
    set attachmentLinkMode(value) {
      if (this.version && value !== this.mode) throw new Error("Cannot change attachment linkMode");
      this.mode = value;
    }
    get attachmentFilename() {
      return "book.pdf";
    }
    getFilePathAsync() {
      return Promise.resolve(
        this.mode === 0 ? `/storage/${this.key}/book.pdf` : "/linked/book.pdf",
      );
    }
    isAttachment() {
      return true;
    }
    isStoredFileAttachment() {
      return this.mode === 0;
    }
    getField() {
      return "Book";
    }
    getTags() {
      return this.tags.map((tag) => ({ tag }));
    }
    addTag(tag) {
      if (!this.tags.includes(tag)) this.tags.push(tag);
    }
    removeTag(tag) {
      this.tags = this.tags.filter((value) => value !== tag);
    }
    getAnnotations() {
      return children.filter((child) => child.parentItemID === this.id);
    }
    toJSON() {
      return {
        key: this.key,
        version: this.version,
        title: "Book",
        linkMode: this.mode === 0 ? "imported_file" : "linked_file",
        tags: this.getTags(),
      };
    }
    fromJSON(data) {
      this.attachmentLinkMode = data.linkMode === "imported_file" ? 0 : 2;
      this.tags = data.tags.map((tag) => tag.tag);
      if (data.path) this.attachmentPath = data.path;
    }
    save() {
      return Promise.resolve();
    }
    erase() {
      assert.equal(
        this.getAnnotations().length,
        0,
        "never erase an attachment with children still attached",
      );
      records.delete(this.id);
      deleted.push(this.key);
      if (failure === "erase" && this.id === 1) throw new Error("erase failed");
      return Promise.resolve();
    }
    eraseTx() {
      return this.erase();
    }
  }

  const source = new Item(mode, mode === 0 ? "storage:book.pdf" : "attachments:book.pdf");
  source.addTag("Personal tag");
  if (mode === 0) {
    files.set(`/storage/${source.key}/book.pdf`, "stored PDF");
    source.addTag("Stored");
    source.addTag("ferry-origin:attachments:book.pdf");
  }
  const create = async (nextMode, { file }) => {
    if (failure === "copy") throw new Error("copy failed");
    const next = new Item(nextMode, nextMode === 0 ? "storage:book.pdf" : file);
    if (nextMode === 0) files.set(`/storage/${next.key}/book.pdf`, files.get(file));
    return next;
  };
  globalThis.Zotero = {
    logError() {},
    Libraries: { userLibraryID: 1 },
    Items: {
      async reload(id) {
        for (const child of children)
          if (id === child.id) child.parentItemID = child.persistedParentItemID;
      },
    },
    Attachments: {
      importFromFile: (options) => create(0, options),
      linkFromFile: (options) => create(2, options),
      getStorageDirectory: (item) => ({ path: `/storage/${item.key}` }),
      getBaseDirectoryRelativePath: (path) => path.replace("/linked/", "attachments:"),
      resolveRelativePath: (path) => path.replace("attachments:", "/linked/"),
    },
    Relations: { copyObjectSubjectRelations: async () => {} },
    Fulltext: {
      transferItemIndex: async () => {
        if (failure === "transfer") throw new Error("transfer failed");
      },
    },
    DB: {
      async executeTransaction(callback) {
        const oldRecords = new Map(records);
        const oldParents = children.map((child) => child.persistedParentItemID);
        const oldDeleted = deleted.length;
        try {
          return await callback();
        } catch (error) {
          records.clear();
          for (const [id, record] of oldRecords) records.set(id, record);
          children.forEach((child, index) => {
            child.persistedParentItemID = oldParents[index];
          });
          deleted.length = oldDeleted;
          throw error;
        }
      },
    },
  };
  const exists = (path) =>
    [...files.keys()].some((file) => file === path || file.startsWith(path + "/"));
  globalThis.IOUtils = {
    exists: async (path) => exists(path),
    async move(from, to) {
      for (const [name, content] of [...files])
        if (name === from || name.startsWith(from + "/")) {
          files.delete(name);
          files.set(to + name.slice(from.length), content);
        }
    },
    async remove(path) {
      for (const name of [...files.keys()])
        if (name === path || name.startsWith(path + "/")) files.delete(name);
    },
  };
  return {
    source,
    records,
    files,
    children,
    deleted,
    fail: (value) => {
      failure = value;
    },
  };
}

test("promote replaces a synced key without changing its mode", async () => {
  const f = fixture();
  const result = await convert(f.source, "stored");
  assert.equal(result.ok, true);
  const stored = f.records.get(result.newID);
  assert.notEqual(stored.key, f.source.key);
  assert.equal(stored.version, 0);
  assert.equal(stored.attachmentLinkMode, 0);
  assert.equal(f.source.attachmentLinkMode, 2);
  assert.deepEqual(f.deleted, [f.source.key]);
  assert.equal(f.children[0].parentItemID, stored.id);
  assert.equal(f.children[0].key, "ANNOTATION");
  assert.equal(getOrigin(stored), "attachments:book.pdf");
  assert.ok(stored.tags.includes("Personal tag"));
  assert.ok(stored.tags.includes("Stored"));
  assert.equal(f.files.get("/linked/book.pdf"), "canonical PDF");
});

test("revert uses a new linked key and preserves annotations and user tags", async () => {
  const f = fixture(0);
  const result = await convert(f.source, "linked");
  assert.equal(result.ok, true);
  const linked = f.records.get(result.newID);
  assert.equal(linked.attachmentLinkMode, 2);
  assert.equal(f.source.attachmentLinkMode, 0);
  assert.equal(f.children[0].parentItemID, linked.id);
  assert.deepEqual(linked.tags, ["Personal tag"]);
  assert.equal(f.files.has(`/storage/${f.source.key}/book.pdf`), false);
  assert.equal(f.files.get("/linked/book.pdf"), "canonical PDF");
});

test("missing origin and missing original preserve the stored attachment", async () => {
  const f = fixture(0);
  f.source.removeTag("ferry-origin:attachments:book.pdf");
  assert.equal((await convert(f.source, "linked")).skipped, true);
  f.source.addTag("ferry-origin:attachments:book.pdf");
  f.files.delete("/linked/book.pdf");
  assert.equal((await convert(f.source, "linked")).skipped, true);
  assert.equal(f.records.size, 1);
  assert.equal(f.files.get(`/storage/${f.source.key}/book.pdf`), "stored PDF");
  assert.deepEqual(f.deleted, []);
});

for (const failure of ["copy", "transfer", "erase"]) {
  test(`${failure} failure restores the source and its annotations`, async () => {
    const f = fixture(0);
    f.fail(failure);
    const result = await convert(f.source, "linked");
    assert.equal(result.ok, false);
    assert.equal(f.records.has(f.source.id), true);
    assert.equal(f.records.size, 1);
    assert.equal(f.children[0].parentItemID, f.source.id);
    assert.equal(f.files.get(`/storage/${f.source.key}/book.pdf`), "stored PDF");
    assert.ok(!f.deleted.includes(f.source.key));
  });
}

test("legacy in-place conversion can be repaired without losing the stored bytes", async () => {
  const f = fixture(0);
  const next = await replaceAttachment(f.source, "stored", await f.source.getFilePathAsync());
  assert.equal(next.version, 0);
  assert.notEqual(next.key, f.source.key);
  assert.equal(f.files.get(`/storage/${next.key}/book.pdf`), "stored PDF");
  assert.equal(getOrigin(next), "attachments:book.pdf");
  assert.equal(f.children[0].parentItemID, next.id);
});
