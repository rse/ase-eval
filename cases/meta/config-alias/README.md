# meta/config-alias

Tailoring ASE for a project over five stages: `ase-meta-config` sets
`agent.persona` in the project scope, `ase-meta-alias` defines an option
alias `--sec` of `ase-code-lint` and a full alias `/lint-sec`, expands
`/lint-sec src/` (it must show `--include=A16 -S HIGH`), and
`ase-meta-config get` reports the value. Checked in `.ase/config.yaml` and
`.ase/aliases.yaml`.
