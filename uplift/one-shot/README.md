one-shot
========

Vague prompt (`prompt.md`), no interaction, 2 runs, at least 1 must
pass, budget $3.00 per run. The baseline arm of the [uplift
benchmark](../README.md).

## Objective

Measures how far plain, one-shot Claude Code gets with a vague request:
`AskUserQuestion` is disallowed (as for every single-shot case), so all
unstated details of the hidden specification -- the command set, the
numeric-vs-string filter rule, `avg` with two decimals, the
`csvq: error:` stderr format, exit code 1 -- must be guessed. Its score
is the reference point against which `plan-mode` and
`flow/csvq-grill` show the value of their process.

## Failures Uncovered

This arm is expected to fail on the persona-only details -- its failures
are the *measurement*, not necessarily defects:

-   **No artifact**: caught by `fileExists: csvq.py`.
-   **Broken core behavior** (column selection, RFC-4180 quoting,
    filtering, aggregation): caught by the three `exec` oracles against
    the hidden reference `oracle.py`.
-   **Guessed-wrong hidden details** (string instead of numeric filter
    comparison, wrong `avg` format, wrong error channel/format/exit
    code, embedded-newline rows counted twice): caught by the hidden
    12-test suite `suite/test_csvq.py`.
-   **Session crash, timeout, or budget excess**: caught by
    `notErrored`.

## Artifacts

Each `results/uplift-<timestamp>/baseline/one-shot/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the one-shot session
-   `diff.patch`, `files/`: the produced `csvq.py` (and stray files)
-   `suite.log`: the full `unittest` output of the hidden suite
-   `result.json`: the oracle outcomes, including the failed test names

The general artifact table is in [`TESTS.md`](../../TESTS.md#artifacts).

## Example Run

```sh
./run_uplift_test.sh
```

Input: a Git sandbox seeded with `fixture/tree/sample.csv` (quoted
commas, `""` escapes, an embedded newline) and the five-line vague
prompt of `prompt.md`. No recorded run exists yet; a run passes only
if `csvq.py` matches the hidden reference on all `exec` vectors and
all 12 hidden suite tests, e.g. ending in `result.json` with:

```
{"kind": "suite", "pass": true, "detail": "12/12 tests passed"}
```
