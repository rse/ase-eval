# code/lint-auto

`ase-code-lint --auto src/stats.js` on a statistics module with typical
smells, the most relevant being that `median()` sorts its input in place.
Checked: the file changed, `check.js` produces the same output as before
(behavior kept), the input of `median()` is no longer mutated, and no `var`, loose
equality, or unused variable remains (with `--auto`, the skill only reports
`LINT FINISHED`, so the result is judged on the file, not the output).
