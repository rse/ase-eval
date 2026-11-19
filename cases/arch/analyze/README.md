# arch/analyze

`ase-arch-analyze packages/` on a four-package JavaScript monorepo with
seeded architecture problems: a `core` <-> `db` dependency cycle, a
low-cohesion `util` package carrying domain rules, and an API that bypasses
the domain layer. Read-only; regex for the cycle, a rubric for the rest.
