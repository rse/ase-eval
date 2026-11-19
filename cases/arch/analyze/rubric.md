# Rubric: Architecture Review of a Small Orders Monorepo

The monorepo has four packages with seeded architecture problems:
(1) a dependency cycle `@orders/core` <-> `@orders/db` (db imports
`isCancellable` from core, core imports db); (2) `@orders/util` is a
low-cohesion "god" package mixing money formatting, mail, HTML, HTTP,
feature flags, CSV, and domain pricing/VAT rules; (3) the API bypasses the
domain layer (`DELETE /orders/:id` sets `status` and calls `saveOrder`
directly instead of `cancelOrder`); (4) side effects (mail) inside the
domain function. Score each criterion and average them:

1.  **Cycle**: the core/db cycle is found and explained, with a sensible
    remedy (dependency inversion, moving the rule).
2.  **Cohesion**: the util package's low cohesion is identified, ideally
    noting that pricing/VAT are domain rules in a utility package.
3.  **Layering**: the API bypassing the domain logic is found.
4.  **Prioritization**: findings are severity-ranked plausibly and cite
    packages/files.
5.  **Signal**: no generic filler; recommendations are actionable.
