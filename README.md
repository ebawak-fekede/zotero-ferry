# zotero-ferry

Promote Zotero **linked** attachments to **stored** files so they sync to mobile,
then ferry them back to their original linked paths when you're done.

For a library that lives in Calibre, where the free 300 MB of Zotero storage can't
hold every book but the mobile app won't open linked files.

## Please buy a subscription if you can

This is a workaround for being broke, not a replacement for paying. Zotero is free
software from a small non-profit, and storage subscriptions are what fund the sync
servers, mobile apps and developers. If Ferry saves you that money, consider sending
some of it Zotero's way anyway.

## Install

Grab `zotero-ferry-<version>.xpi` from the
[latest release](https://github.com/ebawak-fekede/zotero-ferry/releases/latest) and
install it via **Tools → Add-ons → gear → Install Add-on From File…**.

Zotero then updates it on its own: the manifest's `update_url` points at the
`update.json` shipped with each release. The `.xpi` is unsigned.

## Usage

Right-click an item or attachment → **Ferry**:

- **Convert to stored attachment** — copies the file into Zotero storage, records the
  original linked path and tags it `Stored`. The Calibre original is never touched.
- **Return to linked** — resolves the recorded path against the *current* base
  directory, deletes the stored copy, drops the tags.

Select a parent to act on every attachment beneath it. Both actions batch and report
what succeeded, was skipped, or failed.

## Setup

Everything Ferry manages must sit under the linked-attachment base directory:

```
Zotero linked files/            <- Linked Attachment Base Directory
├── Calibre Library/            <- your Calibre library lives inside it
│   └── <Author>/<Title> (<id>)/<file>
└── ...
```

- Set **Linked Attachment Base Directory** on *every* machine (Settings → Advanced →
  Files and Folders). Paths may look different per OS; what matters is that they point
  at the same folder.
- Keep that folder identical across machines with any file-sync tool. Zotero never
  syncs linked files.
- Zotero 10.x — tested against 10.0.3.

Files outside the base directory still work, but their origin is stored as an absolute
path and won't resolve on another machine.

## How it works

- The origin is remembered as a **relative** path (`attachments:Calibre Library/…`) in
  a tag, so it syncs with the library and survives being moved between machines.
  Renaming or formatting that tag is configurable under Settings → Zotero Ferry.
- Promoting **copies**. The original on disk is byte-identical afterwards.
- **Annotations survive** — they live in the database against the attachment item, not
  in the PDF. Ferry only writes them into the file if you use Zotero's "Save to PDF".
- A stored attachment with **no recorded origin is skipped**, not deleted, as is a
  restore whose original file has gone missing.

## Develop

```sh
pnpm install
pnpm typecheck        # tsc --noEmit
pnpm test             # path/memory unit tests + packaging regressions
pnpm build            # -> dist/zotero-ferry-<version>.xpi + update.json
```

Release with `pnpm bump:patch | bump:minor | bump:major`, then `git push --follow-tags`
— the tag triggers the workflow that validates, builds and publishes. See
[CONTRIBUTING.md](CONTRIBUTING.md) for commit, branch and PR conventions.

## Limits

- Group libraries can't use linked files, so Ferry works on the personal library only.
- Zotero mobile/web never sees linked attachments; Ferry is the bridge for what you
  read on mobile, everything else stays linked.
- Reverting deletes the stored copy. Deleting an attachment while it's promoted loses
  the recorded origin — revert first.

## License

MIT
