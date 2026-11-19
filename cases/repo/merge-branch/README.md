# repo/merge-branch

`ase-repo-merge --mode squash feature/discount`: the feature branch of the
`invoice` project has two commits, while `master` moved on with an unrelated
commit (`setup.sh`). Expected: the verdict `MERGED`, the feature on `master`
as exactly one non-merge commit, a clean working tree, the master-only
license section kept, and the hidden suite passing.
