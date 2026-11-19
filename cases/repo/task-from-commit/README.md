# repo/task-from-commit

`ase-repo-task --commit HEAD shipping:` reverse-engineers a task plan from
the last commit of the `invoice` project (a flat, taxed shipping fee and a
`--shipping=` CLI option). Expected: task `shipping` with the
SPECIFICATION/DESIGN/VERIFICATION sections, semantically similar to the
golden plan, and no change to the code.
