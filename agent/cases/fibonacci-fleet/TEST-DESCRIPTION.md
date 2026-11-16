Test Description: `fibonacci-fleet`
===================================

## Purpose

This case tests an *agent fleet* of ASE (`ase agent fleet`) end to end
with the runner `fleet`: the three built-in phase agents `implementer`,
`qualifier`, and `integrator` run all together as long-running members
of a fleet, supervised in the background next to the fleet-owned agent
relay, and hand a single, precisely specified task over to each other on
their own, from `PLANNED` to `INTEGRATED`: a Python program printing the
first N Fibonacci numbers, importing nothing but `sys`. A black-box test
suite then checks the `fibonacci.py` on `master`, partly against a
reference implementation. The generic steps, the fleet flow, and the
pass criteria are described in `agent/README.md`; the agents themselves
work as described for `wordcount-python`.

| File                      | Role                                                           |
|---------------------------|----------------------------------------------------------------|
| `case.json`               | `{ "task": "fibonacci", "program": "fibonacci.py", "runner": "fleet" }` |
| `task.md`                 | the task fixture (ASE task format, id `fibonacci`, `PLANNED`)  |
| `suite/test_fibonacci.py` | the test suite (Python `unittest`, standard library only)      |

## Fleet Configuration

The driver writes `.ase/fleet.yaml` before the project setup commit, so
it is versioned and the `master` working copy stays clean (`tool` and
`timeout` from `--tool` and `--timeout`):

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

The empty `relay` section lets the fleet own the per-user agent relay,
which is isolated by the sandbox `HOME` and listens on a free port of its
own choice. The fleet runs for at most 3 × `--timeout` (default: 90
minutes), counted from before `ase agent fleet start`.

## Coverage

In addition to the coverage of `wordcount-python` (except for the
foreground one-shot agents):

| Area                                                       | Covered | Notes                                              |
|------------------------------------------------------------|---------|----------------------------------------------------|
| `ase agent fleet start/status/stop` (background)           | yes     | detached supervisor, `.ase/fleet.yaml`             |
| the fleet log file                                         | yes     | read directly as `.ase/agent/fleet.log`; the command `ase agent fleet log` is not run |
| fleet-owned `ase agent relay`                              | yes     | started and stopped by the fleet                   |
| agent presence on the relay                                | yes     | all three agents announce themselves              |
| long-running agents handing over a task                    | yes     | no `--one-shot`, polling agents                    |
| `ase agent relay status`                                   | no      | its host-local probe fails under Node 24           |
| fleet member restarts, orphan reaping                      | no      |                                                    |

## Test Suite

`suite/test_fibonacci.py` runs `fibonacci.py` as a subprocess (with the
interpreter running the suite), found through `$AGENT_TEST_PROJECT`. All
13 tests have to pass:

| Test                      | Checks                                                           |
|---------------------------|------------------------------------------------------------------|
| `test_zero`               | `N = 0` prints nothing, exit `0`                                 |
| `test_one`, `test_two`    | `0`, resp. `0 1`                                                 |
| `test_ten`                | `0 1 1 2 3 5 8 13 21 34`                                         |
| `test_hundred_is_exact`   | 100 lines, the last one `218922995834555169026` (no float)       |
| `test_matches_reference`  | `N = 500` equals the suite's own reference implementation        |
| `test_large_count`        | `N = 5000` works (no recursion limit), last value exact          |
| `test_missing_argument`   | `fibonacci: usage: fibonacci.py N` on stderr, no stdout, exit `1` |
| `test_too_many_arguments` | `fibonacci: usage: fibonacci.py N` on stderr, no stdout, exit `1` |
| `test_non_numeric`        | `abc` → `fibonacci: invalid count: abc`, exit `1`                |
| `test_negative`           | `-3` → `fibonacci: invalid count: -3`, exit `1`                  |
| `test_fractional`         | `2.5` → `fibonacci: invalid count: 2.5`, exit `1`                |
| `test_imports_only_sys`   | the program's syntax tree imports no module other than `sys`     |
