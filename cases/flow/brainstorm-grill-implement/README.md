flow/brainstorm-grill-implement
===============================

A 4-stage workflow, brainstorm → plan → grill → implement, of a Python
module `roman.py`, checked by a hidden test suite; 3 runs, 2 must pass,
budget $11.00 in total ($2 + $2 + $4 + $3 per stage).

## Objective

Checks that ASE skills chain into a working end-to-end workflow, each
stage feeding the next, in one sandbox (`solo` lifecycle, Git, changeset
`worktree`):

| Stage | Skill                 | Input                                              | Stage oracle            |
|-------|-----------------------|----------------------------------------------------|-------------------------|
| 1     | `ase-meta-brainstorm` | `--max-clarify 0 --min-ideas 6 --max-shortlist 2 <topic>` | output has `RECOMMENDED` |
| 2     | `ase-task-edit`       | `--plan OVERWRITE --next DONE roman: {{stage1.lastMessage}}` | task `roman` exists |
| 3     | `ase-task-grill`      | `--rounds 2 --until MAY --next DONE roman`, LLM simulator with `persona.md` | output has `GRILLING` |
| 4     | `ase-task-implement`  | `--next DONE roman`                                | `roman.py` exists       |

The persona fixes the intents (two functions, range 1..3999,
`ValueError`s, canonical subtractive notation, case-insensitive
parsing). After stage 4, the hidden suite `suite/test_roman.py` (10
`unittest` tests) is copied into the project and run. `reference/roman.py`
proves the suite passes on a valid module; it is never part of a run.

## Failures Uncovered

-   Brainstorming yields no recommendation (stage 1 `regex`).

-   The brainstorm output is not turned into a saved task plan (stage 2 `taskStore`).

-   Grilling does not happen or derails (stage 3 `regex`, and later the suite).

-   Implementation produces no module (stage 4 `fileExists`).

-   Intents get lost between the stages, e.g. a wrong range, missing
    `ValueError`s, or case-sensitive parsing (final `suite`).

## Artifacts

Per `run-<n>/` (see [`TESTS.md`](../../../TESTS.md) "Artifacts"):

-   `stage-<N>-transcript.md`, `stage-<N>-transcript.jsonl`: one pair per stage
-   `diff.patch`, `files/`: the produced `roman.py` (plus any test file the model wrote)
-   `taskstore/TASK-roman.md`: the plan after grilling and implementation
-   `suite.log`: the full `unittest` output of the hidden suite
-   `result.json`: verdict, per-stage results (`stages[]`), and oracles prefixed `stage<N>/`

## Example Run

```
npm start test -- -K --cases=flow/brainstorm-grill-implement
```

Excerpts of `results/2026-11-16T07-37-07/flow/brainstorm-grill-implement/run-1/`
(all 3 runs passed, $2.12-$2.63 each):

```
stage-1: 🟠 **RECOMMENDED IDEA**: Combine the two: one shared 13-pair table, greedy
         `to_roman`, and a subtractive-scan `from_roman` guarded by the round-trip check. [...]
stage-3: **USER**: 1A 2B 3B 4A 5A 6B 7A 8A 9A 10A
stage-4: ⧉ **ASE**: ◉ task: **roman**, ▶ status: **plan implemented -- done**

suite.log:
test_to_roman_too_large (test_roman.TestRoman.test_to_roman_too_large) ... ok
test_to_roman_zero (test_roman.TestRoman.test_to_roman_zero) ... ok
Ran 10 tests in 0.000s
OK

stage1/regex       pass  all patterns satisfied
stage2/taskStore   pass  task store as expected
stage3/regex       pass  all patterns satisfied
stage4/fileExists  pass  all files exist
suite              pass  10/10 tests passed
```

> **Notice:** in this run the model also wrote its own `test_roman.py`
> (visible in `diff.patch`), although the persona says no tests are
> needed; the hidden suite replaces it before the final check.
