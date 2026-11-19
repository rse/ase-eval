# Rubric: Explaining a Money-Calculation Module

The session explained `invoice/calc.py` of a small invoicing library (line
totals, subtotal, tax, grand total with `Decimal`, quantized to cents with
`ROUND_HALF_EVEN`; callers in `render.py` and `cli.py`). Score each
criterion and average them:

1.  **WHAT**: the functionality of each function is stated correctly.
2.  **WHY**: the rationale for `Decimal`, `Decimal(str(x))`, and the
    rounding to cents per line is explained correctly.
3.  **Gotchas**: real pitfalls are named, e.g. banker's rounding (half-even)
    instead of commercial rounding, float inputs from the CLI, tax computed
    on the rounded subtotal.
4.  **Analogy and diagram**: a fitting everyday analogy and a correct
    control/data-flow diagram.
5.  **Form**: the six sections of the skill (WHAT, WHY, ANALOGY, DIAGRAM,
    CRUXES, GOTCHAS) are present and concise; nothing invented.
