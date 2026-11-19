# Rubric: ChangeLog Entry and Commit Message for a Discount Feature

The staged change adds an optional percentage discount: `discount()` in
`invoice/calc.py`, a `discount_percent` parameter of `grand_total()` and
`render()` (tax computed on the discounted amount), and a `--discount=`
option of the CLI. The session first updated `CHANGELOG.md` (left unstaged,
as the skill does not stage), then proposed a commit message for the
*staged* changes. Score each criterion and average them:

1.  **ChangeLog step**: the ChangeLog skill determined the changes from the
    staged diff and reports that it updated `CHANGELOG.md`.
2.  **Message**: a concise commit message in the project's style (a
    single `FEATURE:`-like line is fine) that names the discount feature
    precisely (e.g. a percentage discount applied before tax, CLI option).
3.  **Accuracy**: the message does not claim anything that is not in the
    staged diff, and does not miss its essence.
4.  **Consistency**: a hint that `CHANGELOG.md` is not part of the staged
    change set is correct and acceptable (it was not staged).
5.  **Restraint**: nothing was committed; the workflow reports its status
    clearly.
