# code/insight

`ase-code-insight invoice/` on the `invoice` project with four commits by two
authors (`setup.sh`): the four sections PROJECT ABSTRACT, PROJECT AUTHOR
(both authors), SOURCE CHURN, and MODULE STRUCTURE must be shown.

Known ASE issue (2026-11-19): Opus 5.5 runs the commands of steps 1-3 in one
`Bash` call and then only displays the diagram of step 4, so the first three
sections never reach the output (2 of 2 runs). The skill shows each section
only *after* its command, which a model batching the commands skips; see
`reports/SKILL-TESTS-2026-11-19.md`.
