task/grill-semantic
===================

`ase-task-grill --rounds 2 --next DONE alpha`, answered by an LLM user
simulator (`claude-sonnet-5-5`) and compared semantically to an
expected plan; 1 run, budget $4.00.

## Objective

Checks the *outcome* of grilling: after two rounds, the saved plan must
carry the decisions of the interviewed developer. The simulator plays
`persona.md` (non-empty, printable name; usage message to stderr and
exit code 1; plain Node.js; exactly `Hello, <name>!`; smoke tests only).
An LLM judge compares the final task body with `expected-plan.md`,
which states these commitments in prose. Where `task/grill-llm` judges
the interview, this case judges the resulting plan.

Fixture: task `alpha` (`OPEN`, `solo` lifecycle), the plan of a tiny
greeting CLI.

## Failures Uncovered

-   The skill errors out, loops, or exceeds the budget or the 10 turns
    (`notErrored`).

-   No grilling interview is produced (`regex` on output: `GRILLING`).

-   The status is changed by grilling (`taskStore` `status: OPEN`).

-   The answers are not merged into the plan, are merged wrongly, or
    the plan drifts away from the greeting CLI: fewer than 3 judge
    votes at or above 0.6 (`similar` on `taskBody` of `alpha`, 3 votes).

## Artifacts

Per `run-<n>/` (see [`TESTS.md`](../../../TESTS.md) "Artifacts"):

-   `transcript.md`, `transcript.jsonl`: both rounds plus the simulated replies
-   `taskstore/TASK-alpha.md`: the grilled plan, compared against `expected-plan.md`
-   `result.json`: verdict, oracle results, and the similarity scores
    with the judge's rationale

## Example Run

```
npm start test -- -K --cases=task/grill-semantic
```

Simulated replies in
`results/2026-11-16T07-37-07/task/grill-semantic/run-1/transcript.md`
(one per round, picking the alternatives matching the persona):

```
⧉ **ASE**: GRILLING ROUND 1/2: *Relentless Interviewing Until Clarity*
[... 10 questions ...]
**USER**:

1A 2A 3A 4C 5B 6A 7A 8B 9C 10B
[...]
⧉ **ASE**: GRILLING ROUND 2/2: *Relentless Interviewing Until Clarity*
[... 3 questions ...]
**USER**:

1B 2A 3B
[...]
**RESULT**: success (turns: 3, cost: $1.1221)
```

Similarity result of `result.json` (pass, abridged):

```
similar  pass  3/3 votes >= 0.6 (scores: 0.86, 0.82, 0.85; The ACTUAL text matches
               the core commitments (Hello output with exit 0, usage error to stderr
               with exit 1 for missing names, greet/main split, plain CommonJS with
               no dependencies, and manual smoke tests), but it omits the
               printable-character validation and the no-i18n/no-config constraints [...])
```
