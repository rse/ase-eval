meta/mint-uuid
==============

`ase-meta-mint uuid test harness fixture`, 1 run, budget $1.00.

## Objective

Checks the simplest complete path through a skill: parse the options,
call one MCP tool, and print the result. `ase-meta-mint` with the
`uuid` type gets the identifier from the MCP tool `ase_mint`. The tool
derives a UUID V5 from the hint, so the value is fixed. The oracle
therefore expects one exact UUID. This tells a correct tool call apart
from a UUID the model invented.

## Failures Uncovered

-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.
-   **UUID invented instead of fetched from `ase_mint`**: caught by
    `regex` on `201e99ec-baed-5d58-9ec7-70d956e26c53`.
-   **Wrong parameters passed to `ase_mint`**, such as a different hint or
    the type `sha1`: caught by the same `regex`, because the derived
    value changes.
-   **Result not printed in the final output**: caught by the same
    `regex`, which reads the output.

## Artifacts

Each `results/<timestamp>/meta/mint-uuid/run-1/` contains:

-   `transcript.md`, `transcript.jsonl`: the option line, the `ase_mint`
    call, and the MINT box
-   `result.json`: the outcome of each oracle

The case writes no project files. The general artifact table is in
[`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=meta/mint-uuid
```

Input: the prompt `/ase:ase-meta-mint uuid test harness fixture` in an
empty sandbox. The leading `uuid` selects the type. Excerpt from
`results/2026-11-16T12-01-24/meta/mint-uuid/run-1/transcript.md`
(`claude-opus-5-5`, passed):

```
⧉ **ASE**: ✪ skill: **ase-meta-mint**, ▶ options: type: **uuid**, count: **1**

**TOOL** `mcp__plugin_ase_ase__ase_mint`: {"type":"uuid","hint":"uuid test harness fixture","count":1}

**ASSISTANT**:
╭────━━━━**(** ⧉ ASE: **`MINT`**: `uuid` **)**━━━━──────────────
│ ●   **HINT**: uuid test harness fixture
│ ○   `201e99ec-baed-5d58-9ec7-70d956e26c53`
╰────━━━━**(** ⧉ ASE: **`MINT`**: `uuid` **)**━━━━──────────────

**RESULT**: success (turns: 3, cost: $0.3623)
```

Oracle results from `result.json`:

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
```
