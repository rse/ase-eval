---
Type:      text/vnd.ase.task
Id:        shipping
Created:   2026-05-06 09:00
Modified:  2026-05-06 09:00
Status:    OPEN
Kind:      CRAFTING
Changeset: branch:feature/shipping
Target:    branch:master
---

#   TASK: Flat Shipping Fee

##  SPECIFICATION (WHAT)

-   [x] IFC: **Shipping Option**: `invoice.cli` accepts `--shipping=<amount>`;
    a negative amount is rejected with an error.

-   [x] DOM: **Taxed Shipping**: the flat shipping fee is added to the
    subtotal before the tax is computed.

##  DESIGN (HOW)

-   [x] IMP: **Grand Total**: `grand_total(lines, rate, shipping=0)` in
    `invoice/calc.py`.

##  VERIFICATION (CHECK)

-   [x] TST: **Totals**: totals with and without shipping.
