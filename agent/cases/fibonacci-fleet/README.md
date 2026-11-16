agent/fibonacci-fleet
=====================

`ase agent fleet` end-to-end test, runner `fleet`: task `fibonacci`
(`PLANNED`) → `INTEGRATED`, program `fibonacci.py` (the first N Fibonacci
numbers, importing only `sys`), 13 suite tests, about $1.70. Generic
steps, fleet flow, and pass criteria: [`agent/README.md`](../../README.md).

| File                      | Role                                                           |
|---------------------------|----------------------------------------------------------------|
| `case.json`               | `{ "task": "fibonacci", "program": "fibonacci.py", "runner": "fleet" }` |
| `task.md`                 | the task fixture (ASE task format, id `fibonacci`, `PLANNED`)  |
| `suite/test_fibonacci.py` | the test suite (Python `unittest`, standard library only)      |

## Objective

Checks that `implementer`, `qualifier`, and `integrator` run **together
as long-running fleet members** (no `--one-shot`), supervised in the
background next to a fleet-owned agent relay, and hand the task over to
each other on their own. The agents work as in
[`wordcount-python`](../wordcount-python/README.md), which covers
everything this case covers except the foreground one-shot agents. The
driver writes and commits `.ase/fleet.yaml` (`tool`/`timeout` from
`--tool`/`--timeout`):

```yaml
relay:
default:
    tool:     claude
    timeout:  30m
    parallel: 1
implementer:
    params:
        effort-wait: false
qualifier:
    mode:     qualify
integrator:
    mode:     squash
```

The empty `relay` section lets the fleet own the per-user relay
(isolated by the sandbox `HOME`, free port). The fleet runs at most
3 × `--timeout` (default 90 min). Additionally covered: `ase agent fleet
start/status/stop`, `.ase/agent/fleet.log` (read directly, `ase agent
fleet log` is not run), and the agent presence on the relay. Not
covered: `ase agent relay status` (its host-local probe fails under
Node 24), member restarts, and orphan reaping.

## Failures Uncovered

| Check (in `report.md`)              | Catches                                                    |
|-------------------------------------|------------------------------------------------------------|
| `fleet started`                     | `ase agent fleet start` fails or exceeds 3 min             |
| `fleet running with all members`    | `relay` or an agent not `running` in `ase agent fleet status` |
| `agents present on the agent relay` | relay unreachable, or an agent never announces itself (15 polls, 2 s apart) |
| `task integrated`                   | a hand-over got stuck, a dead-end status or `:failed` tag, timeout |
| `fibonacci.py on master`            | the change set never landed                                |
| `working copy clean on master`      | leftovers of the integrator                                |
| `all suite tests passed`            | a wrong program; all 13 tests must report `ok`, no skips   |
| `fleet stopped with its agent relay`| supervisor or relay still alive after `ase agent fleet stop` |

The 13 tests of `suite/test_fibonacci.py` check: N = 0, 1, 2, 10;
N = 100 exact (last `218922995834555169026`, no float); N = 500 against
the suite's own reference implementation; N = 5000 (no recursion limit);
usage error on a missing or extra argument; `invalid count` for `abc`,
`-3`, `2.5` (all stderr only, exit `1`); and an AST check that only
`sys` is imported. Infrastructure errors give verdict `ERROR` (exit `2`).

## Artifacts

In `results/agent-<timestamp>-fibonacci-fleet/`:

-   `report.md`, `result.json`: verdict, failure, tool/duration/cost, pipeline table, checks, suite table
-   `agents.log`: the lines of `fleet.log` as followed during the run
-   `fleet.log`: the complete log of the fleet and its members
-   `suite.log`: the verbose `unittest` output
-   `task.md`: the final task plan with the `agent` log attachment
-   `git.log`: the commit graph of all branches with file stats
-   `fibonacci.py`: the program the agents produced

## Example Run

```sh
./run_agent_test.sh --case fibonacci-fleet         # after a cost confirmation
```

Recorded run `results/agent-2026-11-16T15-45-40-883Z-fibonacci-fleet/`
(all agents on `claude-sonnet-5-5`), `report.md` trimmed. For a fleet,
"Duration" is the time from the fleet start until the task reached the
status, and "Exit" is always `0`:

```
# ase agent test: fibonacci-fleet

**Verdict: PASS**

Tool `claude`, duration 3.7m, cost $1.72

| Agent | Exit | Duration | Status after | Expected | Cost | Pass |
| implementer | 0 | 1.6m | IMPLEMENTED | IMPLEMENTED | $0.73 | yes |
| qualifier | 0 | 2.6m | QUALIFIED | QUALIFIED | $0.30 | yes |
| integrator | 0 | 3.4m | INTEGRATED | INTEGRATED | $0.69 | yes |

-   ✓ fleet started: exit 0
-   ✓ fleet running with all members: relay, implementer, qualifier, integrator
-   ✓ agents present on the agent relay: present: qualifier, integrator, implementer
-   ✓ fleet stopped with its agent relay: stop exit 0, fleet gone, relay gone
-   ✓ task integrated: INTEGRATED
-   ✓ fibonacci.py on master: .ase, .gitignore, fibonacci.py
-   ✓ working copy clean on master: branch master
-   ✓ all suite tests passed: passed 13/13, ran 13, failures 0, errors 0, skipped 0
```

`agents.log`, the fleet start and the status transitions (timestamps and
prefixes trimmed):

```
fleet: started relay, implementer, qualifier, integrator
implementer[1]: fibonacci: claimed task (status "PLANNED" → "IMPLEMENTING")
implementer[1]: fibonacci: task processed successfully (status "IMPLEMENTED", tag "ase-agent-implementer")
qualifier[1]: fibonacci: claimed task (status "IMPLEMENTED" → "QUALIFYING")
qualifier[1]: fibonacci: task processed successfully (status "QUALIFYING" → "QUALIFIED", tag "ase-agent-qualifier:approve")
integrator[1]: fibonacci: claimed task (status "QUALIFIED" → "INTEGRATING")
integrator[1]: fibonacci: task processed successfully (status "INTEGRATED", tag "ase-agent-integrator")
```
