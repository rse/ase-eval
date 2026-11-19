# code/lint-auto

`ase-code-lint --auto src/stats.js` on a statistics module with typical
smells, the most relevant being that `median()` sorts its input in place.
Checked: the file changed, `check.js` produces the same output as before
(behavior kept), the input of `median()` is no longer mutated, and a rubric.
