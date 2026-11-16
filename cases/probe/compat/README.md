probe/compat
============

`ase-meta-compat` (no arguments), 2 runs, both must pass, budget $1.00 per run.

## Objective

Checks whether the model under test can execute the four interpreter
primitives that every ASE skill is built on: XML placeholders, control
flow, regex matching, and arithmetic. `ase-meta-compat` runs 25 probes
itself, then compares its results with the expected values that the MCP
tool `ase_compat` returns (`ase util compat` prints the same values).
Each category has its own result row, so a failure shows which primitive
the model breaks.

## Failures Uncovered

-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.
-   **XML placeholders not substituted or substituted wrongly**: caught by
    `regex` on the row `XML Placeholders | … | 6/6`.
-   **Conditions or loops of the skill DSL mis-evaluated**: caught by
    `regex` on the row `Control Flow | … | 6/6`.
-   **Wrong regex match results**: caught by `regex` on the row
    `Regex Matching | … | 7/7`.
-   **Wrong arithmetic**: caught by `regex` on the row `Arithmetic | … | 6/6`.
-   **Missing final verdict or a different one**: caught by `regex` on
    `FULLY COMPATIBLE`.
-   **A failed probe listed in the output** (`failed:`): caught by `regex`
    with `not`.
-   **Results not reproducible**: `runs: 2` with `minPass: 2` fails the
    case if the second run differs.

## Artifacts

Each `results/<timestamp>/probe/compat/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the results table and the verdict
-   `result.json`: the outcome of each oracle

The case writes no project files. The general artifact table is in
[`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=probe/compat
```

Input: the prompt `/ase:ase-meta-compat` in an empty sandbox. Excerpt
from `results/2026-11-16T12-01-24/probe/compat/run-1/transcript.md`
(`claude-opus-5-5`, 2/2 runs passed):

```
**TOOL** `mcp__plugin_ase_ase__ase_compat`: {}
**TOOL** `mcp__plugin_ase_ase__ase_decision_matrix`: {"matrix":[[4,1],[3,1],[2,1],[1,1]]}

| ⦿ *Capability*       | ⚖ *Weight*  | ✓ *Passed* | ⚑ *Rate*  |
| XML Placeholders     |        4.00 |        6/6 |      100% |
| Control Flow         |        3.00 |        6/6 |      100% |
| Regex Matching       |        2.00 |        7/7 |      100% |
| Arithmetic           |        1.00 |        6/6 |      100% |
| **OVERALL**          |             |            | **100%**  |

**VERDICT**: ✓ *FULLY COMPATIBLE*
**RESULT**: success (turns: 4, cost: $0.3886)
```

Oracle results from `result.json`:

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
```
