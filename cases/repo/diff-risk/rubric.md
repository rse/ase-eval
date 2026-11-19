# Rubric: Diff Summary With Coherence, Risk, and Blast Radius

The staged change makes `tax(amount, rate)` in `invoice/calc.py` take the
rate as a fraction (`0.2`) instead of a percentage (`20`) and documents this
in the README -- but its callers were not adapted: `grand_total()` and
`render()` still pass the percentage, and the CLI default is still `20`. As
a result every tax amount (and total) is 100 times too high. Score each
criterion and average them:

1.  **Summary**: a correct, intent-grouped narrative of what changed (the
    unit change of `tax()`, the README note).
2.  **Coherence**: it flags the change as incoherent -- the callers
    (`grand_total()`, `render()`, the CLI's `--tax=` handling and default
    of 20) still pass percentages.
3.  **Risk**: it names the concrete consequence (tax and totals 100x too
    high, e.g. 20 instead of 0.2) and that nothing (no test) catches it.
4.  **Blast radius**: it identifies the affected callers and consumers
    (`grand_total`, `render`, the CLI output, any external caller of the
    public `tax()`).
5.  **Usefulness**: concise, no invented changes; it suggests adapting the
    callers (divide by 100 or change the CLI unit) or keeping the old unit.
