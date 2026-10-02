# zotero-ferry

## The problem

Your library lives in Calibre. Hundreds of books in one folder, and you sync that folder
between machines. Zotero's free 300 MB cannot hold that.

Reading on the Zotero mobile app is a different problem. The app only opens stored
attachments, and a stored attachment is a copy of the file inside Zotero. That copy eats
your quota.

| | Linked attachment | Stored attachment |
|---|---|---|
| Where the file lives | your Calibre folder | inside Zotero |
| Uses free-tier quota | no | yes |
| Opens in the mobile app | no | yes |
| Calibre keeps the only copy | yes | no |

What you want is linked files most of the time, and stored files only for the couple of
books you are reading on a tablet. Zotero will convert linked to stored. It has no way
back. Ferry does both directions, and it remembers where each file came from.

## Install

Download `zotero-ferry-<version>.xpi` from the
[latest release](https://github.com/ebawak-fekede/zotero-ferry/releases/latest).
Then Tools, Add-ons, the gear menu, Install Add-on From File.

Zotero will update the plugin on its own after that. The xpi is unsigned.

## Usage

Right click an item or attachment and open the Ferry menu.

`Convert to stored attachment` copies the file into Zotero storage and writes down where
it came from. It also adds a tag so you can find these items again later. The Calibre
file stays where it is.

`Return to linked` puts the file back where it came from and deletes the copy.

Select a parent item to cover everything attached to it. Both commands handle many items
at once, and they tell you at the end what happened to each one.

## Setup

Ferry only manages files that sit under Zotero's linked attachment base directory, and
your Calibre library has to be inside that directory.

```
Zotero linked files/          <- set this as the Linked Attachment Base Directory
└── Calibre Library/
```

Set the base directory on every machine. The path can differ from machine to machine, it
just has to point at the same folder. Sync that folder yourself, Zotero never syncs
linked files.

Tested on Zotero 10.0.3.

## How it works

The original path is stored on the item as a tag, as a relative path. So promoting on one
machine and returning on another still works when the folder sits somewhere else.

Promoting copies the file. The Calibre copy keeps its bytes, so you can always go back.

Annotations live in Zotero's database, attached to the item, so moving a file between
linked and stored keeps them. Zotero's own "Save to PDF" also writes them into the file.

If Ferry cannot work out where a file came from, it leaves the stored copy alone. Same if
the original file has gone missing. Nothing gets deleted as a side effect.

## Develop

```
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

To cut a release, run `pnpm bump:patch` (or minor, or major), then `git push
--follow-tags`. The tag triggers a workflow that builds and publishes. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the commit and branch rules.

## Limits

Group libraries cannot use linked files, so Ferry works on your personal library only.

Zotero mobile and the web library never see linked files. Ferry is what gets a book onto
your tablet, and the rest can stay linked.

Returning to linked deletes the stored copy. Revert an attachment before you delete it.

## Please buy a subscription if you can

I built this because I could not pay for Zotero storage. It is a workaround, and you
should still think about paying if you can. Zotero is free software from a small non
profit, and subscriptions pay for the servers and the developers. If Ferry saved you the
money, sending some of it to Zotero is a nice thing to do.

## License

MIT
