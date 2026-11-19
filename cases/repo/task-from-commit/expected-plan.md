#   TASK: Flat Shipping Fee

##  SPECIFICATION (WHAT)

-   An invoice can carry an optional flat shipping fee (default 0).
-   The shipping fee is added to the subtotal before tax, i.e. it is taxed
    at the same rate as the items.
-   The CLI accepts `--shipping=<amount>`; a negative amount is rejected
    with the error `invoice: error: --shipping must not be negative`.

##  DESIGN (HOW)

-   `grand_total(lines, rate, shipping=0)` in `invoice/calc.py` adds the
    shipping fee, quantized to cents, to the subtotal and computes the tax
    on the sum.
-   `parse()` in `invoice/cli.py` reads the `--shipping=` option and
    validates it.

##  VERIFICATION (CHECK)

-   Totals with and without shipping are correct (shipping taxed).
-   A negative shipping fee is rejected by the CLI with the error message.
