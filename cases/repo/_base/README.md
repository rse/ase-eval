# repo/_base

Not a case: the shared `invoice` project of the `repo/*` cases. Their
`fixture.setup` scripts source `init.sh`, which copies `tree/` into the
sandbox repository and commits it, and then build the case-specific Git state
(staged or unstaged hunks, branches, an in-progress merge, patch files).
