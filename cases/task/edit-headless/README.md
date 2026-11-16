task/edit-headless
==================

`ase-task-edit --plan REFINE --next DONE alpha: <instruction>`, run
headless without any dialog; 2 runs, 1 must pass, budget $2.50.

## Objective

Checks that `ase-task-edit` refines an existing task plan from a
one-shot instruction, saves it through the MCP tool `ase_task_save`,
and finishes without asking (`--next DONE`). The instruction asks for
name validation in the `greet` function of the seeded `greet.js`. The
skill must only change the plan, never the code.

Fixture: task `alpha` (`OPEN`, `solo` lifecycle, a 4-bullet plan for a
greeting CLI) plus `fixture/tree/greet.js`, committed to Git.

## Failures Uncovered

-   The skill errors out, hangs on a dialog it should skip, or exceeds
    the budget (`notErrored`).

-   The plan is not saved, or the refinement is lost: the task body
    does not mention validation (`taskStore` `bodyMatch: "valid"`).

-   The lifecycle status is changed by an edit (`taskStore`
    `status: OPEN`).

-   The skill implements instead of plans: `greet.js` or any other
    project file is modified (`gitDiff` `empty: true`).

## Artifacts

Per `run-<n>/` (see [`TESTS.md`](../../../TESTS.md) "Artifacts"):

-   `transcript.md`, `transcript.jsonl`: the session
-   `taskstore/TASK-alpha.md`: the refined plan (the main thing to inspect)
-   `result.json`: verdict and oracle results

No `diff.patch` and no `files/`, as a passing run leaves the project unchanged.

## Example Run

```
npm start test -- -K --cases=task/edit-headless
```

Input: `/ase:ase-task-edit --plan REFINE --next DONE alpha: the greet
function must also validate that the name argument is a non-empty
string and report a usage error otherwise`.

Excerpt of the refined plan,
`results/2026-11-16T07-37-07/task/edit-headless/run-1/taskstore/TASK-alpha.md`:

```
-   [ ] DOM: **Name Validation**: The name must be a *non-empty string*; otherwise the tool
    reports a *usage error* instead of a greeting.

-   [ ] IFC: **Usage Error**: A missing or empty `<name>` prints `usage: greet.js <name>` to
    stderr and exits with code 1, without printing a greeting.
[...]
-   [ ] CON: **Usage Error**: `node greet.js` and `node greet.js ""` each print
    `usage: greet.js <name>` to stderr, nothing to stdout, and exit with code 1.
```

Status lines of the transcript, then the oracle results (both runs passed):

```
⧉ **ASE**: ◉ task: **alpha**, ▶ status: **plan refined**
⧉ **ASE**: ◉ task: **alpha**, ▶ status: **plan saved**
⧉ **ASE**: ◉ task: **alpha**, ▶ status: **plan finalized -- done**
**RESULT**: success (turns: 8, cost: $0.9152)

notErrored  pass  no error
taskStore   pass  task store as expected
gitDiff     pass  diff touches [  ]
```
