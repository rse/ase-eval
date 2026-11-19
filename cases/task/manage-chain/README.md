# task/manage-chain

A task-management session over six skills on a seeded store (`alpha`,
`beta`, the obsolete `gamma`): `ase-task-id` sets `beta` as the current task,
`ase-task-view` shows it (the current task id is session state, so the
view names it explicitly), `ase-task-rename` renames it to
`report-cli-flags`, `ase-task-assign` assigns it to `alice`,
`ase-task-estimate --all` estimates all unestimated tasks, and
`ase-task-delete` removes `gamma`. The final store is checked.
