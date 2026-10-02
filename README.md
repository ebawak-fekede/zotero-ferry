# zotero-ferry

## The problem

I keep my books in Calibre and link them from Zotero. That saves space, but Zotero's
mobile app needs stored attachments. Its free 300 MB fills up quickly with large books.

Ferry lets me store a few books while I'm reading them on mobile, then return them to
linked attachments when I'm done. It remembers their original locations.

## Install

Download the `.xpi` from the [latest release](https://github.com/ebawak-fekede/zotero-ferry/releases/latest).
In Zotero, use Tools > Plugins > the gear menu > Install Plugin From File.

Zotero checks for later versions through the plugin's update feed.

## Usage

Right-click an attachment or its parent item and open the Ferry menu.

`Convert to stored attachment` creates a stored copy and adds the `Stored` tag.

`Return to linked` restores the link to the original file and removes the stored copy.

Both commands support multiple selections. Annotations and attachment metadata carry
over. The original file stays in place.

## Setup

Ferry works with any linked file. For use on several computers, keep the files under
Zotero's Linked Attachment Base Directory. A Calibre setup can look like this:

```text
Zotero linked files/
└── Calibre Library/
```

Set that base directory on each computer in Settings > Advanced > Files and Folders.
Each computer can use a different path to its copy of the folder. Keep the files in
sync yourself; Zotero doesn't sync linked files.

Requires Zotero 10.x. Tested on 10.0.3.

## How it works

Ferry keeps the original path in an attachment tag, using a relative path when possible.
That record syncs with the library, so another desktop can restore the link.

Each conversion creates a replacement attachment and transfers its annotations. This
is required by Zotero's sync service. A restore is skipped if the original file or its
recorded path is missing.

Group libraries cannot use linked files. Revert an attachment before deleting it.

## Development

```sh
pnpm install
pnpm format
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Release with `pnpm bump:patch` (or `bump:minor`, `bump:major`), then `git push --follow-tags`.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the PR and commit rules.

## Support Zotero

I built this because I couldn't afford a storage subscription. If you can afford one,
please [buy Zotero Storage](https://www.zotero.org/storage). Subscriptions help fund
Zotero's servers and development.

## License

MIT
