task/grill-llm
==============

`ase-task-grill --rounds 2 --next DONE alpha`, answered by an LLM user
simulator and judged by a rubric; 1 run, budget $4.00.

## Objective

Checks the *quality* of a two-round grilling interview, not only its
mechanics (see `task/grill-scripted` for those). An LLM simulator plays
the developer of `persona.md`, who holds firm intents: non-empty,
printable name; usage message to stderr and exit code 1 on violation;
plain Node.js; exactly `Hello, <name>!`; smoke test only. An LLM judge
then scores the transcript against `rubric.md`:

1.  plan-specific questions (not generic filler)
2.  grounded answer alternatives, current plan marked
3.  focus areas (DOMAIN, INTERFACE, ARCHITECTURE, ...)
4.  the interview concludes with a plan update

Fixture: task `alpha` (`OPEN`, `solo` lifecycle), the plan of a tiny
greeting CLI.

## Failures Uncovered

-   The skill errors out, loops, or exceeds the budget or the 10 turns
    (`notErrored`).

-   No grilling interview is produced (`regex` on output: `GRILLING`).

-   The status is changed by grilling (`taskStore` `status: OPEN`).

-   Generic questions, missing alternatives or focus areas, or an
    interview stopping with unprocessed answers: fewer than 3 judge votes
    at or above 0.6 (`rubric`, 3 votes).

## Artifacts

Per `run-<n>/` (see [`TESTS.md`](../../../TESTS.md) "Artifacts"):

-   `transcript.md`, `transcript.jsonl`: both rounds plus the simulated replies
-   `taskstore/TASK-alpha.md`: the plan after grilling
-   `result.json`: verdict, oracle results, and the rubric scores with
    the judge's rationale

## Example Run

```
npm start test -- -K --cases=task/grill-llm
```

Excerpt of `results/2026-11-16T07-37-07/task/grill-llm/run-1/transcript.md`
(rows truncated):

```
⧉ **ASE**: GRILLING ROUND 1/2: *Relentless Interviewing Until Clarity*
| **1** ▶ **DOM** ▷ **Missing name**: Shall `greet.js` called without `<name>` (or with an empty name) fail, instead of greeting a default like `World`? | …
| **3** ▶ **IFC** ▷ **Error contract**: Shall usage errors print `Usage: greet.js <name>` to stderr and exit with code `1`? | …
[...]
**USER**:

Answer all with persona picks: 1A 2C 3A 4A 5A 6A 7A
[...]
-   [ ] DOM: **Invalid Input**: A *missing* or *zero-length* `<name>`, or *more than one* argument, is rejected as a usage error, without any greeting. […]
⧉ **ASE**: ◉ task: **alpha**, ▶ status: **plan updated -- done**
**RESULT**: success (turns: 3, cost: $1.2339)
```

Rubric result of `result.json` (pass, abridged):

```
rubric  pass  3/3 votes >= 0.6 (scores: 0.80, 0.88, 0.88; The output runs two
              grilling rounds with plan-specific questions [...] The alternatives
              are grounded, but the current plan is marked with ⚑ on only two of
              the ten questions, so that criterion is only partly met.)
```

> **Notice:** in this recorded run the simulator's reply leaked its own
> reasoning ("Wait — persona: ...") into the user message; the case
> still passed, as only the skill side is judged.
