ferry-menu-promote =
    .label = Make available on mobile
    .accesskey = M
ferry-menu-revert =
    .label = Return to linked
    .accesskey = R
ferry-promote-confirm = Promote { $count ->
        [one] { $count } linked attachment
       *[other] { $count } linked attachments
    } to stored files? The original linked file is left untouched on disk.
ferry-revert-confirm = Return { $count ->
        [one] { $count } stored attachment
       *[other] { $count } stored attachments
    } to their original linked paths? The stored copy will be deleted.
ferry-nothing-selected = No eligible attachments in the current selection.
ferry-dry-run = Dry run — nothing was written.
ferry-done = Ferry finished: { $ok } succeeded, { $skipped } skipped, { $failed } failed.
