# task/integrate-branch

`ase-task-integrate --mode squash shipping`: the task plan `shipping`
(`Changeset: branch:feature/shipping`, `Target: branch:master`) has its
implementation on a feature branch with two commits, while `master` moved
on (`setup.sh`, reusing `repo/_base`). Expected: the merge verdict `MERGED`,
the feature on `master` as exactly one squash commit, the master-only
license kept, the hidden suite passing, and the plan still present.
