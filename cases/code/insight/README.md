# code/insight

`ase-code-insight invoice/` on the `invoice` project with four commits by two
authors (`setup.sh`): the four sections PROJECT ABSTRACT, PROJECT AUTHOR
(both authors), SOURCE CHURN, and MODULE STRUCTURE must be shown.

Intermittent ASE issue (2026-11-19): in 2 development runs, where this
skill ran as the second stage right after `ase-code-explain`, Opus 5.5 ran
the commands of steps 1-3 in one `Bash` call and then only displayed the
diagram of step 4, so the first three sections never reached the output.
Run standalone, it passed 2/2. The skill shows each section only *after* its
command, which a model batching the commands can skip; see
`reports/SKILL-TESTS-2026-11-19.md` (S2).
