review/context-returns
======================

`ase-repo-review -c HEAD -S LOW` on a seeded change commit; 3 runs,
2 must pass, $5.00 and 20 min per run. Hard tier of the review
benchmark ([`docs/review/README.md`](../../../docs/review/README.md)).

## Objective

Measures whether `ase-repo-review` finds defects that need **context
beyond the diff**: a larger change ("Add returns, partial refunds and
store credit"; 15 base files, 11 changed) where half of the defects only
show up through unchanged code (`report.ts`, `store.ts`), concurrency, or
domain rules from the README. Built to leave headroom where the base tier
saturates. The review runs read-only; findings are matched to
`solution/expected.json` **by file and line** (±3 lines).

## Failures Uncovered

-   **Missed defects** (`review` oracle, recall ≥ 0.5 overall, ≥ 0.8 for
    the obvious tier):
    -   obvious: restocking skips the first return line (B-01), return
        mail addressed to the order id (B-02)
    -   medium: store credit double spend across an `await` (B-03),
        per-line rounding of refunds does not add up (B-04)
    -   hidden: revenue report drops `partially_refunded` orders (B-05,
        in unchanged `report.ts`), `toRecord` loses `paidWith` (B-06, in
        unchanged `store.ts`), repeated partial-refund event throws
        (B-07), goodwill refunds ignore pending refunds (B-08)
-   **Under-rated severity** (`review`, adequate-severity recall ≥ 0.4)
-   **False alarms** (`review`, decoy match rate ≤ 0.25): findings on the
    decoys K-01..K-05 (refund limit before an async booking, date strings
    compared as text, division by the order total, unescaped article
    number, credit-paid order marked paid) -- each safe by context
-   **Unparseable output** or **benchmark contamination** (`review`)
-   **Review modifies the project** (`gitDiff { empty: true }`)
-   **Crash, budget, or timeout** (`notErrored`)

## Artifacts

Per `results/<timestamp>/review/context-returns/run-<n>/` (generic
table: [`TESTS.md`](../../../TESTS.md#artifacts)):

-   `review.log`: the review text the scorer parsed (verdict + findings table)
-   `transcript.md`, `transcript.jsonl`: decoded and raw session
-   `result.json`: oracle results; the `review` oracle's `metrics` hold
    `recall` per tier and `adequate`, `hits`, `decoys_reported`,
    `unassignable`, and the per-criterion `threshold` verdict

The case directory also keeps `reference/runs/` (the six Opus and Sonnet
runs of 2026-11-12), `solution/fixes.json`, and `solution/proofs/`, used
by the standalone tools of `src/review/` (`prove.mjs`), not by this case.

## Example Run

```
npm start test -- --cases=review/context-returns
```

Recorded in `results/2026-11-16T08-17-33/` (Opus 5.5), `review.log` of run 1, trimmed:

```
🟠 **REVIEW VERDICT**: **REJECT - DEMANDS CHANGES**
| **HIGH**   | PROPAGATION | ▢ `src/store.ts:6-18`: `toRecord` does not copy the new `paidWith` field, ...
| **HIGH**   | CORRECTNESS | ▢ `src/returns.ts:92-94`: `restockLines` starts at `i = 1`, ...
| **HIGH**   | ROBUSTNESS  | ▢ `src/credit.ts:49-53`: `spendCredit` checks the balance it read before `await book(...)` ...
| **MEDIUM** | PROPAGATION | ▢ `src/report.ts:14`: `revenue` still counts only orders with status `paid`. ...
```

`review` oracle detail, identical in all 3 runs (all passed, $0.79-0.97, 93-102 s each):

```
recall 1.00 (obvious 1.00, medium 1.00, hidden 1.00), adequate 1.00, decoys 0.00, unassignable 0
```

All 8 defects in every run: for Opus 5.5 this case shows a ceiling
effect, too.
