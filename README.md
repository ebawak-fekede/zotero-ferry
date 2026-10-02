# zotero-ferry

Temporarily promote Zotero **linked** attachments to **stored** files so they sync to
mobile, then ferry them back to their original linked paths when you're done.

For a library that lives in Calibre, where free-tier
Zotero storage can't hold every book but the mobile app won't open linked files.

## Please buy a subscription if you can

I wrote this because I couldn't afford Zotero Storage — the free 300 MB doesn't go far
when your library is books. Ferry is a workaround for being broke, not a replacement
for paying.

Zotero is free software from a small non-profit, and storage subscriptions are what
fund it: the sync servers, the mobile apps, the support, the developers. If Ferry just
saved you that money, consider sending some of it Zotero's way anyway.

## Requirements

The plugin assumes one specific layout — that's what makes the round trip portable.

```
Zotero linked files/            <- Linked Attachment Base Directory
├── Calibre Library/            <- your Calibre library lives INSIDE the base dir
│   └── <Author>/<Title> (<id>)/<file>
└── ...anything else you link
```

Everything you want Ferry to manage must sit under `Zotero linked files/`, including
the Calibre library. Files outside it can still be promoted, but their origin is
stored as an absolute path and won't resolve on another machine.

Also required:

- **A way to keep `Zotero linked files/` identical on every machine** (any file-sync
  tool). Zotero itself never syncs linked files — that's the whole point.
- **Linked Attachment Base Directory** set to that folder on *every* machine
  (Settings → Advanced → Files and Folders). On Linux under a Flatpak sandbox it may
  look different from Windows; what matters is that it points at the same folder and
  that attachments are stored in the `attachments:<relative>` form.
- **Zotero 7+** (built against 8.*).
- Attachment paths stored **relative**. Ferry writes them that way by default; the
  historical absolute ones in an existing library are what break cross-machine.

Not required: Calibre running, any Calibre API, or network access.

## The problem

| | Linked attachment | Stored attachment |
|---|---|---|
| File lives in | `Zotero linked files/` (yours to sync) | `Zotero/storage/<KEY>/` |
| Consumes free-tier quota | no | **yes** |
| Opens in Zotero mobile | **no** | yes |
| Calibre stays source of truth | yes | no (duplicate) |

You want linked for daily use and stored only for whatever you're actively reading on
a tablet. Stock Zotero converts linked → stored but has **no** reverse.

## What it does

Right-click an item or attachment → **Ferry**:

- **Make available on mobile** — copies the file into Zotero storage, flips the item
  to `storage:<filename>`, records the original linked path, tags it `Stored`. The
  Calibre original is never touched.
- **Return to linked** — reads the recorded path back, resolves it against the
  *current* base directory, deletes the stored copy, flips the item back to linked.

Select a parent to act on every attachment beneath it. Both actions batch and report
succeeded / skipped / failed.

## Why the round trip is safe

**Portable memory.** The origin is stored as a *relative* path
(`attachments:Calibre Library/…`), not the absolute path at promote time. Promote on
one machine, revert on another — it resolves against whatever the base directory is
set to locally.

**Works across machines.** Paths are stored relative and handled as plain strings, so
a base directory that looks different on each OS doesn't break the round trip.

**Copy, never move.** Promoting copies. The Calibre file stays byte-identical on
disk, so a revert or a mistake can always go back.

**Annotations survive.** They live in the Zotero database and hang off the attachment
*item*, not the PDF — 2,885 of this library's 6,142 annotations are already on linked
attachments. Flipping `linkMode` doesn't touch them. They're only written *into* the
file by Zotero's opt-in "Save to PDF", which Ferry doesn't replicate.

## How the origin is remembered

Attachment items only carry `title`, `url`, `accessDate` — no `extra` field. So Ferry
writes two tags per promoted item:

| tag | default | purpose |
|---|---|---|
| status | `Stored` | human-facing; what you filter on |
| origin | `ferry-origin:attachments:Calibre Library/…` | machine-readable, holds the portable path |

Both are stripped on revert. Tags sync with library data, so the memory follows the
item. Rename either in Settings → Zotero Ferry.

## Install

```sh
pnpm install
pnpm build             # -> dist/zotero-ferry-0.1.0.xpi
```

Then **Tools → Add-ons → gear → Install Add-on From File…** and enable it. The `.xpi`
is unsigned, so it may need a debug-friendly build.

## Configure

Plugin options live in **Settings → Zotero Ferry**: tag names for the status and
origin markers, confirmation prompts, and a **dry run** mode that reports what would
change without writing anything.

## Development

```sh
pnpm typecheck         # tsc --noEmit
pnpm test              # unit tests for the pure path/memory logic
pnpm build             # bundle + package
```

```
src/
  paths.ts     path handling (pure fns take OS as a param -> unit-testable)
  memory.ts    origin tag encode/decode (pure) + Zotero tag wrappers
  promote.ts   linked -> stored
  revert.ts    stored -> linked
  ui.ts        item context menu + result reporting
  calibre.ts   resolve a book path from Calibre's `(<id>)` folder naming
  index.ts     IIFE entry exposing the `ZoteroFerry` global
  types.ts     narrow ambient decls for the Zotero script scope
tests/         node --test suites for paths + memory
build.mjs      esbuild bundle, copy payload, zip the .xpi
```

The path and memory modules keep every OS-specific input as a parameter, so the
tricky part — portable path round-tripping — is tested without a Zotero runtime.

## Limits

- **Group libraries** can't use linked files, so Ferry only works on the personal library.
- **Zotero mobile / web** never sees linked attachments; Ferry is the bridge for what
  you read on mobile, everything else stays linked.
- **Reverting** deletes the stored copy. Anything done to *that copy* outside Zotero is
  gone; the Calibre original is untouched.
- **Deleting the attachment while promoted** drops the origin tag — revert first.
- `calibre.ts` resolves a book path from Calibre's folder naming but isn't wired into
  the menu yet.

## License

MIT
