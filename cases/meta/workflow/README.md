# meta/workflow

`ase-meta-workflow --scope local release-prep ...` generates a new
project-local skill orchestrating four ASE skills (sequential lint, two
concurrent steps, a final commit message). Checked: the generated
`.claude/skills/release-prep/SKILL.md` exists, names all four skills, and a
rubric on structure and orchestration.
