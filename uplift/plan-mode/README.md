plan-mode
=========

Vague prompt (`prompt.md`) in Claude Code plan mode, guarded Opus-played
user, 2 runs, at least 1 must pass, budget $5.00 per run. The middle arm
of the [uplift benchmark](../README.md).

## Objective

Measures what Claude Code's built-in plan mode adds over one-shotting:
the session starts with `permissionMode: plan` (a case key, see `TESTS.md`), must explore and plan before touching files,
and can interrogate the simulated user. The user (`persona.md`, played
by `claude-opus-5-5`) holds the full hidden specification but answers
only what is asked, in 1-3 sentences. The harness auto-approves the
session's `ExitPlanMode` call and switches to `acceptEdits`, so the
approved plan is implemented in the same session.

## Failures Uncovered

-   **Plan mode machinery broken** (no `ExitPlanMode`, no
    implementation after approval, writes blocked): caught by
    `fileExists: csvq.py` and `notErrored`.
-   **Questions not asked or answers ignored**: the persona-only
    details (numeric filter rule, `avg` with two decimals,
    `csvq: error:` to stderr, exit code 1) are then guessed and caught
    by the hidden 12-test suite.
-   **Broken core behavior** (selection, RFC-4180 quoting, filtering,
    aggregation): caught by the three `exec` oracles against the hidden
    reference `oracle.py`.
-   **Dialog stall** (plan never approved within 12 user turns, 900s,
    or $5.00): caught by `notErrored`.

## Artifacts

Each `results/uplift-<timestamp>/baseline/plan-mode/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the session incl. the plan,
    the questions, and the simulated user's answers
-   `diff.patch`, `files/`: the produced `csvq.py`
-   `suite.log`: the full `unittest` output of the hidden suite
-   `result.json`: the oracle outcomes, including the failed test names

The general artifact table is in [`TESTS.md`](../../TESTS.md#artifacts).

## Example Run

```sh
./run_uplift_test.sh
```

Input: a Git sandbox seeded with `fixture/tree/sample.csv`, the vague
prompt of `prompt.md`, plan mode, and the guarded persona. No recorded
run exists yet; a passing run shows planning plus elicitation in the
transcript (an `ExitPlanMode` call followed by implementation) and ends
in `result.json` with:

```
{"kind": "suite", "pass": true, "detail": "12/12 tests passed"}
```
