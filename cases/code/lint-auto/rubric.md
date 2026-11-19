# Rubric: Automatic Linting of a Statistics Module

`src/stats.js` had several quality problems: `median()` sorts its input
array in place (a side effect on the caller's data), an unused variable,
loose equality (`==`), `var` instead of `const`/`let`, and the dead
`else` after `return`. With `--auto`, the skill was to fix the accepted
findings itself while keeping the behavior. Score each criterion and average
them:

1.  **Detection**: the input mutation of `median()` and the other problems
    were found.
2.  **Fixes**: the applied corrections are correct and idiomatic (copy
    before sorting, strict equality, `const`/`let`, the unused variable
    removed).
3.  **Behavior**: the public results are unchanged (same exports, same
    numbers).
4.  **Restraint**: no gratuitous rewrites beyond the findings, and the
    existing code style is kept.
5.  **Reporting**: every finding is reported with its solution preview and
    status.
