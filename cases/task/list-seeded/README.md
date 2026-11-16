task/list-seeded
================

`ase-task-list` with no arguments on a store of three seeded tasks;
1 run, budget $1.00.

## Objective

Checks that `ase-task-list` reads the task store through the MCP tool
`ase_task_list` and applies its default filter: finished tasks are
hidden. The fixture seeds three tasks in the `solo` lifecycle:

| Task    | Status    | Expected in the listing |
|---------|-----------|-------------------------|
| `alpha` | `OPEN`    | yes                     |
| `beta`  | `SHELVED` | yes                     |
| `gamma` | `CLOSED`  | no (finished)           |

## Failures Uncovered

-   The skill errors out or exceeds the budget (`notErrored`).

-   The MCP tool is not called, or the model lists tasks from its own
    imagination: `alpha` or `beta` missing (`regex` match).

-   The default `exclude: finished` filter is ignored: `gamma` shows up
    (`regex` not).

-   A read-only skill changes the store: a task is added or deleted
    (`taskStore` `count: 3`).

## Artifacts

Per `run-<n>/` (see [`TESTS.md`](../../../TESTS.md) "Artifacts"):

-   `transcript.md`, `transcript.jsonl`: the session
-   `taskstore/`: `TASK-{alpha,beta,gamma}.md` and `PROJECT.yaml` after the run
-   `result.json`: verdict and the three oracle results

## Example Run

```
npm start test -- -K --cases=task/list-seeded
```

Input: `/ase:ase-task-list` in a sandbox with the three tasks above.
Excerpt of `results/2026-11-16T07-37-07/task/list-seeded/run-1/transcript.md`:

```
**TOOL** `mcp__plugin_ase_ase__ase_task_list`: {"verbose":false}

**ASSISTANT**:

⧉ **ASE**: ◉ tasks:

| *Task Id*  |
|------------|
| **alpha**  |
| **beta**   |

⧉ **ASE**: ✪ skill: **ase-task-list**, ▶ status: **skill finished**

**RESULT**: success (turns: 3, cost: $0.3596)
```

Oracle results of `result.json` (pass):

```
notErrored  pass  no error
regex       pass  all patterns satisfied
taskStore   pass  task store as expected
```
