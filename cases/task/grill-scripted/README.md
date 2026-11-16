task/grill-scripted
===================

`ase-task-grill --rounds 1 --next DONE alpha`, answered by a scripted
user simulator; 1 run, budget $2.50.

## Objective

Checks the multi-turn mechanics of `ase-task-grill` deterministically:
the skill must render its grilling question table, stop at the dialog,
accept the user's answer in the next turn, update the plan, and finish.
The simulator is rule-based (`answers.yaml`), so the user side never
varies:

```yaml
rules:
  - when: "GRILLING|QUESTION"
    answer: "Choose alternative A for every question."
default: "Proceed as you see fit, no further input from my side."
end: "skill finished"
```

Fixture: task `alpha` (`OPEN`, `solo` lifecycle), the plan of a tiny
greeting CLI `greet.js <name>`.

## Failures Uncovered

-   The skill errors out, loops, or exceeds the budget or the 8 turns
    (`notErrored`).

-   No grilling interview is produced (`regex` on output: `GRILLING`).

-   The dialog never reaches the simulator, i.e. the skill does not stop
    for an answer, so the scripted reply is never sent (`regex` on
    `dialog`: `alternative A`).

-   The task status is changed by grilling (`taskStore` `status: OPEN`).

## Artifacts

Per `run-<n>/` (see [`TESTS.md`](../../../TESTS.md) "Artifacts"):

-   `transcript.md`, `transcript.jsonl`: all turns, the simulated user
    replies included as `**USER**` blocks
-   `taskstore/TASK-alpha.md`: the plan after grilling
-   `result.json`: verdict and oracle results

## Example Run

```
npm start test -- -K --cases=task/grill-scripted
```

Excerpt of `results/2026-11-16T07-37-07/task/grill-scripted/run-1/transcript.md`
(table rows truncated):

```
⧉ **ASE**: GRILLING: *Relentless Interviewing Until Clarity*

| QUESTION | ANSWERS |
| -------- | ------- |
| **1** ▶ **DOM** ▷ **Missing name**: Shall `greet.js` without `<name>` fail with usage on stderr and exit code `1`, or fall back to a default name? | **A** ▶ **Fail**: …
| **2** ▶ **DOM** ▷ **Multi-word names**: Shall extra arguments like `greet.js Jane Doe` be joined into one name, or shall only the first argument count? | …
[... 6 more questions ...]

**RESULT**: success (turns: 6, cost: $0.7850)

**USER**:

Choose alternative A for every question.
[...]
**RESULT**: success (turns: 3, cost: $0.9170)
```

Oracle results of `result.json` (pass):

```
notErrored  pass  no error
regex       pass  all patterns satisfied     (output: GRILLING)
regex       pass  all patterns satisfied     (dialog: alternative A)
taskStore   pass  task store as expected
```
