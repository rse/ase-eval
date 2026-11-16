review/security-refunds
=======================

`ase-repo-review -c HEAD -S LOW` on a seeded change commit; 3 runs,
2 must pass, $5.00 and 20 min per run. Base tier of the review
benchmark ([`docs/review/README.md`](../../../docs/review/README.md)).

## Objective

Measures whether `ase-repo-review` finds **security defects** in a
change commit ("Add admin refunds and payment webhooks": admin refund
endpoint, signed payment webhook, order-details API, HTML mails; 12 base
files, 8 changed, `src/notify.ts` deleted) and rates them with an
**adequate severity**, without flagging hardened code as insecure. The
review runs read-only; findings are matched to `solution/expected.json`
**by file and line** (±3 lines).

## Failures Uncovered

-   **Missed defects** (`review` oracle, recall ≥ 0.6 overall, ≥ 0.8 for
    the obvious tier):
    -   obvious: refund amount taken from the request (B-01), admin check
        lets callers without a role through (B-02)
    -   medium: IDOR in the order lookup (B-03), webhook signature only
        checked when present (B-04), discount code unescaped in the HTML
        mail (B-05)
    -   hidden (cross-file): refund pays the pre-discount subtotal (B-06),
        failed payment keeps the stock reserved (B-07)
-   **Under-rated severity** (`review`, adequate-severity recall ≥ 0.5):
    a defect found but reported below its `min_severity` (HIGH for B-01..B-04, B-06)
-   **False alarms** (`review`, decoy match rate ≤ 0.25): findings on the
    decoys K-01..K-04 (constant-time XOR comparison, regex-guarded
    `Number()`, deliberately logged outbox errors, idempotent repeat
    event)
-   **Unparseable output** or **benchmark contamination** (`review`)
-   **Review modifies the project** (`gitDiff { empty: true }`)
-   **Crash, budget, or timeout** (`notErrored`)

## Artifacts

Per `results/<timestamp>/review/security-refunds/run-<n>/` (generic
table: [`TESTS.md`](../../../TESTS.md#artifacts)):

-   `review.log`: the review text the scorer parsed (verdict + findings table)
-   `transcript.md`, `transcript.jsonl`: decoded and raw session
-   `result.json`: oracle results; the `review` oracle's `metrics` hold
    `recall` per tier and `adequate`, `hits`, `decoys_reported`,
    `unassignable`, and the per-criterion `threshold` verdict

## Example Run

```
npm start test -- --cases=review/security-refunds
```

Recorded in `results/2026-11-16T08-17-33/` (Opus 5.5), `review.log` of run 1, trimmed:

```
🟠 **REVIEW VERDICT**: **REJECT - DEMANDS CHANGES**
| **HIGH**   | SECURITY    | ▢ `src/webhook.ts:62-63`: The HMAC check only runs when a signature is present, ...
| **HIGH**   | SECURITY    | ▢ `src/admin.ts:20-22`: "`requireAdmin`" only throws when "`user.role !== "admin" && user.role !== undefined`", ...
| **HIGH**   | SECURITY    | ▢ `src/api.ts:33-37`: "`handleGetOrder`" never compares "`query.customerId`" with "`order.customer.id`", ... (IDOR).
| **HIGH**   | CORRECTNESS | ▢ `src/refund.ts:26`: A full refund now pays out "`order.subtotal`", the amount before the discount, ...
| **MEDIUM** | CORRECTNESS | ▢ `src/order.ts:108-112`: "`markFailed`" sets the order to "`failed`" without "`releaseAll(order.items)`" ...
```

`review` oracle detail per run (all 3 passed, $0.66-0.67, 72-80 s each):

```
run 1: recall 1.00 (obvious 1.00, medium 1.00, hidden 1.00), adequate 1.00, decoys 0.00, unassignable 2
run 2: recall 1.00 (obvious 1.00, medium 1.00, hidden 1.00), adequate 1.00, decoys 0.00, unassignable 2
run 3: recall 1.00 (obvious 1.00, medium 1.00, hidden 1.00), adequate 1.00, decoys 0.25, unassignable 0
```

Run 3 hit decoy K-03 (outbox errors only logged): a decoy match rate of
0.25 is still within the limit.
