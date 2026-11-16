probe/task-status
=================

`ase-task-status alpha: SHELVED`, 3 runs, at least 2 must pass, budget $1.00 per run.

## Objective

Checks a state-changing MCP tool call. The skill must call
`ase_task_status` with the correct parameters (`id: alpha`,
`status: SHELVED`). The status change `OPEN` → `SHELVED` is valid in the
`solo` lifecycle model. The case checks the result in the task store,
not only in the text the skill prints, and requires that no project file
changes.

## Failures Uncovered

-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.
-   **New status not reported**: caught by `regex` on `SHELVED`.
-   **Status claimed in the output but never stored**, for example a
    missing, malformed, or wrongly parameterized tool call: caught by
    `taskStore {id: alpha, status: SHELVED}`.
-   **Status changed by editing files directly instead of through the MCP
    tool**: caught by `gitDiff {empty: true}`.
-   **Behavior not stable across runs**: caught by `runs: 3` with
    `minPass: 2`.

## Artifacts

Each `results/<timestamp>/probe/task-status/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the `ase_task_status` call and
    the status line
-   `taskstore/`: a copy of `.ase/task/` (`PROJECT.yaml` and
    `TASK-alpha.md` with its final status)
-   `result.json`: the outcome of each oracle

The general artifact table is in [`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=probe/task-status
```

Input: a Git sandbox with the `solo` lifecycle model and the seeded
`fixture/TASK-alpha.md` (`Status: OPEN`, `Kind: CRAFTING`), plus the
prompt `/ase:ase-task-status alpha: SHELVED`. Excerpt from
`results/2026-11-16T12-01-24/probe/task-status/run-1/transcript.md`
(`claude-opus-5-5`, 3/3 runs passed):

```
**TOOL** `ToolSearch`: {"query":"select:mcp__plugin_ase_ase__ase_task_status","max_results":1}
**TOOL** `mcp__plugin_ase_ase__ase_task_status`: {"id":"alpha","status":"SHELVED"}

**ASSISTANT**:
⧉ **ASE**: ◉ task: **alpha**, ◐ status: **SHELVED** (*updated*), ▶ set status of task "alpha" from "OPEN" to "SHELVED"
⧉ **ASE**: ✪ skill: **ase-task-status**, ▶ status: **skill finished**

**RESULT**: success (turns: 3, cost: $0.3508)
```

Oracle results from `result.json`:

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
{"kind": "taskStore",  "pass": true, "detail": "task store as expected"}
{"kind": "gitDiff",    "pass": true, "detail": "diff touches [  ]"}
```
