probe/call-order
================

A plain prompt (no skill), 3 runs, at least 2 must pass, budget $1.00
per run.

## Objective

Checks that the model *obeys an instructed tool-call order*. The prompt
demands exactly four MCP tool calls on the seeded task `alpha` --
`ase_task_load`, `ase_task_save` (appending one marker line),
`ase_task_status` (to `SHELVED`), `ase_task_assign` (to `probe`) -- in
exactly this order, with no other MCP calls, no retries, and no merges.
The `toolSequence` oracle asserts the *observed* call sequence, so a
model that reaches the same end state on a different path (reordering,
skipping, repeating, or silently repairing a failed call) still fails.
End-state oracles alone cannot see that difference.

## Failures Uncovered

-   **Out-of-order, extra, or missing calls**: caught by `toolSequence`
    with `mode: exact` -- the detail names the first violation. Real
    failure classes of this kind: qwen re-ran a failed `ase_getopt`
    with the offending option silently stripped
    (run `2026-11-17T02-26-35`, probe/getopt-error), and gpt-astra
    fetched the `ase_compat` answer key before running the probes
    (run `2026-11-16T19-01-38`, probe/compat).
-   **Wrong end state**: the appended marker, the `SHELVED` status, and
    the `Assignee: probe` key are checked by `taskStore` and a `regex`
    oracle over the stored task file -- order alone is not enough
    either.
-   **Direct file manipulation**: a model editing `.ase/task/` or
    project files instead of calling the tools is caught by
    `toolSequence` (missing calls) and `gitDiff` (must stay empty).

On failure the runner prints the case's `failHint`: the violation is an
instruction-following weakness of the model, not a gateway problem.

## Artifacts

Each `results/<timestamp>/probe/call-order/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the tool calls in order
-   `taskstore/`: the final state of the seeded task store
-   `result.json`: the outcome of each oracle, incl. the `toolSequence`
    detail naming the first out-of-order call

The general artifact table is in [`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=probe/call-order
```

No recorded run of this case exists yet. The expected failure shape:

```
✘ probe/call-order run 1 (35s, $0.4000)
    ✘ toolSequence: call 3 was "ase_task_assign", expected "ase_task_status" (got: ase_task_load, ase_task_save, ase_task_assign, ase_task_status)
    ↪ hint: the model violated the instructed tool-call order: ...
```
