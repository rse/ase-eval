agent/wordcount-python
======================

`ase agent` end-to-end test, runner `pipeline`: task `wordcount`
(`PLANNED`) → `INTEGRATED`, program `wordcount.py` (a Python `wc`
clone), 12 suite tests, about $1.70. Generic steps, runners, and pass
criteria: [`agent/README.md`](../../README.md).

| File                      | Role                                                          |
|---------------------------|---------------------------------------------------------------|
| `case.json`               | `{ "task": "wordcount", "program": "wordcount.py", "runner": "pipeline" }` |
| `task.md`                 | the task fixture (ASE task format, id `wordcount`, `PLANNED`) |
| `suite/test_wordcount.py` | the test suite (Python `unittest`, standard library only)     |

## Objective

Checks that the three built-in phase agents of the `enterprise`
lifecycle drive one precisely specified task **headless** from `PLANNED`
to `INTEGRATED`, run one after the other in the foreground
(`--foreground --one-shot`), and leave a working program on `master`:

| Agent         | Claims        | Skill prompt (with the `branch:` changeset of the test)                      | Success       | Failure    |
|---------------|---------------|------------------------------------------------------------------------------|---------------|------------|
| `implementer` | `PLANNED`     | `/ase:ase-task-implement --next DONE --changeset worktree [--worktree <path>] wordcount` | `IMPLEMENTED` | `STALLED`  |
| `qualifier`   | `IMPLEMENTED` | `/ase:ase-repo-review --branch cs-wordcount`                                 | `QUALIFIED` (`APPROVE`) | `DECLINED` (`REJECT`) |
| `integrator`  | `QUALIFIED`   | `/ase:ase-task-integrate --next DONE --mode squash [--worktree <path>] wordcount` | `INTEGRATED`  | `DEFERRED` |

Along the way the agents claim the task by a conditional save (status,
tag `ase-agent-<kind>:active`, `Assignee:`), implement on branch
`cs-wordcount` in the ASE worktree `.ase/worktree/cs-wordcount`, store
the verdict as tag `ase-agent-qualifier:approve`/`:reject`, squash-merge
into `master` with a snapshot attachment, append their log to the
`agent` attachment, and use the on-demand ASE service. Also exercised:
`ase setup install --dev` into an isolated `HOME`, `ase config set`,
`ase task lifecycle`, `ase task save/status/load`, and the opt-in agent
tools `copilot`/`codex` (`--tool`).

Not covered: fleet and relay (see `fibonacci-fleet`), the other agents
(`estimator` replaced by `effort-wait=false`), other modes and
changesets, `--repo` clones, remote stores, parallelism, crash recovery,
the task board, and provoked failure paths (only detected).

## Failures Uncovered

| Check (in `report.md`)          | Catches                                                        |
|---------------------------------|----------------------------------------------------------------|
| `task integrated`               | an agent left the happy path (`STALLED`, `DECLINED`, `DEFERRED`, `:failed` tag), a claim or status probe broke |
| `wordcount.py on master`        | the change set never landed (worktree, branch, or squash merge broken) |
| `working copy clean on master`  | leftovers of the integrator, HEAD not back on `master`         |
| `all suite tests passed`        | a wrong program; all 12 tests must report `ok`, no skips       |

The 12 tests of `suite/test_wordcount.py` (run as a subprocess, byte-exact
fixtures, `\r\n` normalized, project via `$AGENT_TEST_PROJECT`) cover:
empty file, text without `\n`, multiple lines with an empty one, mixed
whitespace, Unicode code points (not bytes), `\r` counted as a character,
stdin with no name, empty stdin, `total` line for several files and none
for one, missing file (exit `1`, stderr only), and a missing file among
others. Early stops (agent exit ≠ 0, timeout, cost ceiling) show as
`failure`, but fail the run only through these checks. Infrastructure
errors give verdict `ERROR` (exit `2`).

## Artifacts

In `results/agent-<timestamp>-wordcount-python/`:

-   `report.md`, `result.json`: verdict, failure, tool/duration/cost, pipeline table, checks, suite table
-   `agents.log`: the output of the three agents, prefixed by agent name
-   `suite.log`: the verbose `unittest` output
-   `task.md`: the final task plan with the `agent` log attachment
-   `git.log`: the commit graph of all branches with file stats
-   `wordcount.py`: the program the agents produced

## Example Run

```sh
./run_agent_test.sh --case wordcount-python        # after a cost confirmation
node agent/ase-agent-test.mts --dry-run            # sandbox and task only, no tokens
```

Recorded run `results/agent-2026-11-16T15-45-40-883Z-wordcount-python/`
(all agents on `claude-sonnet-5-5`), `report.md` trimmed:

```
# ase agent test: wordcount-python

**Verdict: PASS**

Tool `claude`, duration 3.6m, cost $1.69

| Agent | Exit | Duration | Status after | Expected | Cost | Pass |
| implementer | 0 | 1.7m | IMPLEMENTED [ase-agent-implementer] | IMPLEMENTED | $0.67 | yes |
| qualifier | 0 | 0.7m | QUALIFIED [ase-agent-implementer, ase-agent-qualifier:approve] | QUALIFIED | $0.34 | yes |
| integrator | 0 | 1.0m | INTEGRATED [ase-agent-implementer, ase-agent-qualifier:approve, ase-agent-integrator] | INTEGRATED | $0.68 | yes |

-   ✓ task integrated: INTEGRATED
-   ✓ wordcount.py on master: .ase, .gitignore, wordcount.py
-   ✓ working copy clean on master: branch master
-   ✓ all suite tests passed: passed 12/12, ran 12, failures 0, errors 0, skipped 0
```

`agents.log`, the status transitions (timestamps and prefixes trimmed):

```
implementer[1]: wordcount: claimed task (status "PLANNED" → "IMPLEMENTING")
implementer[1]: wordcount: running: claude -p [...] "/ase:ase-task-implement --next DONE --changeset worktree --worktree cs-wordcount wordcount"
implementer[1]: wordcount: task processed successfully (status "IMPLEMENTED", tag "ase-agent-implementer")
qualifier[1]: wordcount: claimed task (status "IMPLEMENTED" → "QUALIFYING")
qualifier[1]: wordcount: task processed successfully (status "QUALIFYING" → "QUALIFIED", tag "ase-agent-qualifier:approve")
integrator[1]: wordcount: claimed task (status "QUALIFIED" → "INTEGRATING")
integrator[1]: wordcount: task processed successfully (status "INTEGRATED", tag "ase-agent-integrator")
```

`git.log`: the change set landed as one squashed commit on `master`:

```
* 5e5e494  (HEAD -> master) Squashed commit of the following:
|  wordcount.py | 37 +++++++++++++++++++++++++++++++++++++
* 90f3ebb  ASE project setup
* 89e4133  initial commit
```
