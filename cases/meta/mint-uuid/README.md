meta/mint-uuid
==============

`ase-meta-mint --type uuid test harness fixture`, 1 run, budget $1.00.

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
    `regex` on `de7fe4e9-9e28-501d-a4bc-91491d07cdb1`.
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

Input: the prompt `/ase:ase-meta-mint --type uuid test harness fixture`
in an empty sandbox. `--type uuid` selects the type, the rest is the
hint. Excerpt from
`results/2026-11-16T19-09-35/meta/mint-uuid/run-1/transcript.md`
(`global.openai.gpt-6-sol`; its `ase_mint` call and value match the
current oracle, though that run was still scored against the older
argument form):

```
⧉ **ASE**: ✪ skill: **ase-meta-mint**, ▶ options: type: **uuid**, count: **1**

**TOOL** `mcp__plugin_ase_ase__ase_mint`: {"type":"uuid","hint":"test harness fixture","count":1}

**ASSISTANT**:
╭────━━━━**(** ⧉ ASE: **`MINT`**: `uuid` **)**━━━━──────────────
│ ●   **HINT**: test harness fixture
│ ○   `de7fe4e9-9e28-501d-a4bc-91491d07cdb1`
╰────━━━━**(** ⧉ ASE: **`MINT`**: `uuid` **)**━━━━──────────────

**RESULT**: success (turns: 3, cost: $0.2806)
```

Oracle results from `result.json`:

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
```
