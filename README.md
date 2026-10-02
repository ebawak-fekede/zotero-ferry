# zotero-ferry

## The problem

Your library lives in Calibre — books, hundreds of them, kept in one folder and synced
between machines. Zotero's free 300 MB can't hold that. But the mobile app will only
open **stored** attachments, which copy the file into Zotero storage and bill your
quota for the privilege.

| | Linked attachment | Stored attachment |
|---|---|---|
| Where the file lives | your Calibre folder | inside Zotero |
| Uses free-tier quota | no | **yes** |
| Opens in the mobile app | **no** | yes |
| Calibre stays the single copy | yes | no (duplicate) |

You want linked attachments day to day and stored ones only for whatever you're
actively reading on a tablet. Stock Zotero converts linked → stored, but has **no way
back**. Ferry does both directions and remembers where each file came from.

## Install

Grab `zotero-ferry-<version>.xpi` from the
[latest release](https://github.com/ebawak-fekede/zotero-ferry/releases/latest) and
install it via **Tools → Add-ons → gear → Install Add-on From File…**.

Zotero updates it on its own afterwards. The `.xpi` is unsigned.

## Usage

Right-click an item or attachment → **Ferry**:

- **Convert to stored attachment** — copies the file into Zotero storage and remembers
  the original location. The Calibre original is never touched.
- **Return to linked** — puts the file back where it came from and removes the stored
  copy.

Select a parent to act on every attachment beneath it. Both actions batch and report
what succeeded, was skipped, or failed.

## Setup

Everything Ferry manages must live under Zotero's linked-attachment base directory,
with the Calibre library inside it:

```
Zotero linked files/          <- set this as the Linked Attachment Base Directory
└── Calibre Library/
```

- Set that base directory on *every* machine (Settings → Advanced → Files and Folders).
  The path can differ per machine; it just has to point at the same folder.
- Keep the folder in sync across machines yourself. Zotero never syncs linked files.
- Zotero 10.x — tested against 10.0.3.

## How it works

- **The original location is remembered**, as a relative path, so promoting on one
  machine and reverting on another works even when the folder sits somewhere else.
- **Promoting copies** rather than moves, so the Calibre file is unchanged and going
  back is always possible.
- **Annotations are kept.** They live in Zotero's database against the item rather than
  in the PDF, so a round trip doesn't disturb them.
- **Nothing is destroyed on a mistake.** A stored file whose original location wasn't
  recorded is left alone rather than deleted, and so is a restore whose original has
  gone missing.

## Develop

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Release with `pnpm bump:patch | bump:minor | bump:major`, then `git push --follow-tags`.
See [CONTRIBUTING.md](CONTRIBUTING.md) for commit, branch and PR conventions.

## Limits

- Group libraries can't use linked files, so Ferry works on the personal library only.
- The mobile app never sees linked attachments; Ferry is the bridge for what you read
  on mobile, everything else stays linked.
- Reverting removes the stored copy. Delete an attachment only after reverting it.

## Please buy a subscription if you can

This is a workaround for being broke, not a replacement for paying. Zotero is free
software from a small non-profit, and storage subscriptions are what fund the sync
servers, mobile apps and developers. If Ferry saves you that money, consider sending
some of it Zotero's way anyway.

## License

MIT
