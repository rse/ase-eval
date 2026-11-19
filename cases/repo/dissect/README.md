# repo/dissect

`ase-repo-dissect --max-parts 3` on an uncommitted change set of the
`invoice` project (`setup.sh`) that mixes three concerns (currency suffix,
README usage section, CLI `--version`). Checked (`check-parts.sh`): 2-3 part worktrees, each concern in exactly one
of them, and the original working copy left untouched.
