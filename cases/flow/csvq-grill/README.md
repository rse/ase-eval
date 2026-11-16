flow/csvq-grill
===============

A vague request through the ASE workflow (`ase-task-edit` →
`ase-task-grill` → `ase-task-implement`), guarded Opus-played user,
2 runs, at least 1 must pass, budget $9.00 per run (3 stages). Also the
ASE arm of the [uplift benchmark](../../../uplift/README.md).

## Objective

A workflow regression: from a deliberately vague request ("a small
command line tool `csvq.py` to select, filter, and aggregate CSV
data"), stage 1 composes a task plan with the simulated user, stage 2
grills it (`--rounds 2 --until MAY`) against the same user, and stage 3
implements the grilled plan headless (worktree changeset, `solo`
lifecycle). The user (`persona.md`, played by `claude-opus-5-5`) holds
the full hidden specification but answers only what is asked -- the
grilling exists to dig exactly these details out. Run via
`run_uplift_test.sh`, its score is compared against the plain-Claude
baseline arms in `uplift/`.

## Failures Uncovered

-   **Plan never materialized**: caught by the stage-1 diagnostic
    `taskStore {id: csvq, exists: true}`.
-   **Grilling did not run**: caught by the stage-2 diagnostic `regex`
    on `GRILLING`.
-   **Implementation missing or stuck in the worktree**: caught by the
    stage-3 diagnostic and the case-level `fileExists: csvq.py`.
-   **Details not elicited by the grilling** (numeric filter rule, `avg`
    with two decimals, `csvq: error:` to stderr, exit code 1): caught by
    the hidden 12-test suite.
-   **Broken core behavior** (selection, RFC-4180 quoting, filtering,
    aggregation): caught by the three `exec` oracles against the hidden
    reference `oracle.py`.
-   **Stage crash, timeout, or budget excess**: caught by `notErrored`
    (an errored stage skips the remaining stages).

## Artifacts

Each `results/<timestamp>/flow/csvq-grill/run-<n>/` contains:

-   `stage-<N>-transcript.{md,jsonl}`: one pair per stage (edit, grill,
    implement), incl. the grilling dialog with the simulated user
-   `taskstore/`: the final task plan `TASK-csvq.md`
-   `diff.patch`, `files/`: the produced `csvq.py`
-   `suite.log`: the full `unittest` output of the hidden suite
-   `result.json`: per-stage results plus the case oracle outcomes

The general artifact table is in [`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```sh
./run_all_tests.sh --cases='flow/csvq-grill'    # as a plain regression
./run_uplift_test.sh                            # as the ASE arm, with comparison
```

Input: a Git sandbox seeded with `fixture/tree/sample.csv`, the vague
request as stage-1 argument, and the guarded persona on stages 1 and 2.
No recorded run exists yet; a passing run shows the elicited details in
`taskstore/TASK-csvq.md` and ends in `result.json` with:

```
{"kind": "suite", "pass": true, "detail": "12/12 tests passed"}
```

> **Notice:** `oracle.py`, `suite/`, and `persona.md` are duplicated in
> `uplift/{one-shot,plan-mode}/` -- keep the copies in sync when editing.
