# repo/import-patch

`ase-repo-import patches/currency.patch`: a contributed patch (made against
the initial version) adds a `--currency=` option to the `invoice` CLI, while
the local working copy has an uncommitted edit on a nearby line (default tax
rate 19). Expected: verdict `IMPORTED`, both changes present (no markers, no
`.rej`/`.orig`), nothing committed, and the CLI output of both changes
combined.
