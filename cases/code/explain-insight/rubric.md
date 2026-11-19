# Rubric: Explaining Code and Giving Project Insights

The session first explained `invoice/calc.py` (line totals, subtotal, tax,
grand total with `Decimal` and `ROUND_HALF_EVEN`), then gave insights into the
`invoice/` project (four commits by Dana Developer and Sam Smith, modules
`calc`, `render`, `cli`). Score each criterion and average them:

1.  **WHAT/WHY**: the explanation correctly states what the module does and
    why it uses `Decimal` and quantizing to cents (no float rounding errors
    in money).
2.  **Gotchas**: it points out real pitfalls, e.g. banker's rounding
    (half-even) instead of commercial rounding, `Decimal(str(float))`
    conversions, tax computed on the rounded subtotal.
3.  **Analogy and diagram**: a fitting everyday analogy and a correct
    control/data-flow diagram.
4.  **Insights**: the project abstract, the authors (both), the churn
    table, and the module structure (render imports calc, cli imports
    render) are correct.
5.  **Form**: concise sections as defined by the skills; nothing invented.
