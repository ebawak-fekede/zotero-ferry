# Contributing

## Commits

Conventional Commits. Subject is an imperative sentence in sentence case, so it
reads as a command: *Add*, *Prioritize*, *Release*.

```
<type>: <imperative subject>

<body explaining what changed and why, wrapped near 72 columns>
```

Types in use: `feat`, `fix`, `chore`, plus `docs`, `refactor`, `test`, `ci`,
`build`, `perf` where they fit.

```
feat: Add video watermarking support

Uses ffmpeg overlay to apply the same centered logo watermark
to videos as images. Skips unreadable files gracefully.

fix: Prioritize hero film loading
docs: Adopt the git conventions used across the work repos
chore: Release v0.1.1
```

No trailing period on the subject. Scope (`feat(promote): …`) is optional.

## Branches

```
feature/<slug>          new work
bugfix/<slug>           fixes          <- bugfix/, not fix/
feature/<TICKET>-<slug> when tied to an issue
```

## Pull requests

Title prefix must match the branch prefix. `bugfix/…` becomes `bugfix: …`, `feature/…`
becomes `feature: …`. Don't substitute the commit type.

Merge with a merge commit, the `Merge pull request #N from <org>/<branch>` shape. Not
squash, not rebase.

## Releases

```
pnpm bump:patch | bump:minor | bump:major
git push --follow-tags
```

`pnpm version` rewrites `package.json`, commits as `chore: Release v%s`, and tags
`v%s`. Pushing the tag triggers the release workflow, which validates the tag
against `package.json`, runs typecheck/test/build, and publishes the `.xpi` plus
the auto-update manifest.

Never hand-edit the version in `manifest.json`. `build.mjs` injects it from
`package.json` at build time.
