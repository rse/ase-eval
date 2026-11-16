review/correctness-cents
========================

`ase-repo-review -c HEAD -S LOW` on a seeded change commit; 3 runs,
2 must pass, $5.00 and 20 min per run. Base tier of the review
benchmark ([`docs/review/README.md`](../../../docs/review/README.md)).

## Objective

Measures whether `ase-repo-review` finds **correctness and robustness
defects** in a realistic change commit ("Update order handling": cents
migration, discount kinds, order options) of a small TypeScript shop
(12 base files, 7 changed), without being lured by code that only looks
wrong. The review runs read-only (`Edit`, `Write`, `NotebookEdit`,
`WebFetch`, `WebSearch` disallowed). Findings are matched to
`solution/expected.json` **by file and line** (±3 lines), not by wording.

## Failures Uncovered

-   **Missed defects** (`review` oracle, recall ≥ 0.6 overall, ≥ 0.8 for
    the obvious tier), seeded in three tiers:
    -   obvious: off-by-one loop in `countUnits` (B-01), `percentOff`
        returns the discount instead of the reduced total (B-02)
    -   medium: `saveOrder` not awaited inside `try` (B-03), shared
        `DEFAULT_OPTIONS.tags` mutated (B-04), duplicate SKU throws
        without releasing reservations (B-05)
    -   hidden (cross-file): cents formatted as euros in `api.ts` (B-06),
        refund ignores the order currency (B-07)
-   **False alarms** (`review`, decoy match rate ≤ 0.25): findings on the
    four decoys K-01..K-04 (documented `switch` fall-through, safe
    non-null assertion, correct `length - 1` bound, intended `== null`)
-   **Unparseable output** (`review`): no verdict line or findings table
-   **Benchmark contamination** (`review`): a tool call reads the
    benchmark files or the ASE repository outside `plugin/` and `tool/`
-   **Review modifies the project** (`gitDiff { empty: true }`)
-   **Crash, budget, or timeout** (`notErrored`)

## Artifacts

Per `results/<timestamp>/review/correctness-cents/run-<n>/` (generic
table: [`TESTS.md`](../../../TESTS.md#artifacts)):

-   `review.log`: the review text the scorer parsed (verdict + findings table)
-   `transcript.md`, `transcript.jsonl`: decoded and raw session
-   `result.json`: oracle results; the `review` oracle's `metrics` hold
    `recall` per tier, `hits`, `decoys_reported`, `unassignable`,
    `duplicates`, and the per-criterion `threshold` verdict

## Example Run

```
npm start test -- --cases=review/correctness-cents
```

Recorded in `results/2026-11-16T08-17-33/` (Opus 5.5), `review.log` of run 1, trimmed:

```
🟠 **REVIEW VERDICT**: **REJECT - DEMANDS CHANGES**
| **HIGH**   | CORRECTNESS | ▢ `src/cart.ts:30-31`: Off-by-one: `i <= items.length` reads `items[items.length].quantity`, ...
| **HIGH**   | CORRECTNESS | ▢ `src/discount.ts:51-52`: `percentOff` returns the discount amount ...
| **HIGH**   | PROPAGATION | ▢ `src/api.ts:35`: `order.total` is now in cents ... but is still passed to `formatEuro` ...
| **MEDIUM** | PROPAGATION | ▢ `src/refund.ts:21`: `refundOrder` calls `issueRefund(order.id, order.total)` without `order.currency` ...
```

`review` oracle detail per run (all 3 passed, $0.63-0.66, ~65 s each):

```
run 1: recall 1.00 (obvious 1.00, medium 1.00, hidden 1.00), decoys 0.00, unassignable 0
run 2: recall 1.00 (obvious 1.00, medium 1.00, hidden 1.00), decoys 0.00, unassignable 1
run 3: recall 0.86 (obvious 1.00, medium 0.67, hidden 1.00), decoys 0.00, unassignable 1
```

Run 3 missed B-04 (shared `tags` array) but still met the thresholds.
