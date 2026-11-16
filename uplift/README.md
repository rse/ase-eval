The ASE Uplift Benchmark: What Does ASE Add?
============================================

A three-arm experiment: the *same* vague request -- "a small command
line tool `csvq.py` to select, filter, and aggregate CSV data" -- is
solved three ways, and only the final artifact is tested, black-box,
with identical oracles. The difference between the arms is purely the
*process*, so their pass rates, hidden-test scores, costs, and durations
measure the uplift of planning and grilling over one-shotting.

| Arm | Lives in | Process | Interaction |
|---|---|---|---|
| `one-shot` | [`uplift/one-shot/`](one-shot/) | plain Claude Code, single prompt | none: every unstated detail must be guessed |
| `plan-mode` | [`uplift/plan-mode/`](plan-mode/) | Claude Code plan mode (`permissionMode: plan`) | questions and plan approval against the simulated user |
| `ase-grill` | [`cases/flow/csvq-grill/`](../cases/flow/csvq-grill/) | ASE workflow: `ase-task-edit` → `ase-task-grill` → `ase-task-implement` | plan refinement and grilling against the simulated user |

The two baseline arms test *plain Claude*, not ASE, so they live here
and are not part of the regular suite (the harness reads them via
`--cases-dir uplift`). The ASE arm is a regular workflow regression
case and stays in `cases/`; the benchmark runs it together with the
baselines, under the same conditions.

The simulated user (`persona.md`, played by `claude-opus-5-5`) holds a
detailed hidden specification (exact commands, numeric-vs-string filter
comparison, RFC-4180 quoting, error format, exit codes) but is
*guarded*: it answers only what is asked, in 1-3 sentences, and never
volunteers the specification. The coding agent runs on the Claude Code
default models in all arms. A good process digs the details out; the
one-shot arm never can.

## Scoring

All arms share the same oracles: `fileExists: csvq.py`, three `exec`
oracles comparing `csvq.py` against the hidden reference `oracle.py`
on fixed stdin vectors, and the hidden 12-test `unittest` suite
(`suite/test_csvq.py`), copied into the sandbox only after the session.
The suite separates the arms: core engineering (parsing, quoting) is
guessable, the persona-only details (numeric filter rule, `avg` with
two decimals, `csvq: error:` prefix, exit code 1) usually are not.

## Running and comparing

```sh
./run_uplift_test.sh                        # all three arms + comparison (~$15-25, 6 runs)
npm start test -- -C uplift -d              # describe the baseline arms (free)
```

The runner executes the baselines (`--cases-dir uplift`), then the ASE
arm (`--cases flow/csvq-grill`), both into one
`results/uplift-<timestamp>/` base, and finally `uplift/compare.mts`
prints the comparison -- including the time/cost view:

```
| arm        | run | outcome | suite tests | exec oracles | cost  | duration |
|------------|-----|---------|-------------|--------------|-------|----------|
| one-shot   | 1   | fail    | 6/12        | 1/3          | $1.21 | 5.2m     |
| plan-mode  | 1   | fail    | 10/12       | 3/3          | $2.44 | 9.0m     |
| csvq-grill | 1   | pass    | 12/12       | 3/3          | $6.10 | 19.2m    |

uplift (hidden suite tests of the best run): one-shot 6/12, plan-mode 10/12, csvq-grill 12/12
```

(Illustrative numbers.) A *failing baseline is an expected result*, not
a regression: the runner's exit code is the ASE arm's, and the
baselines only propagate an infrastructure stop (exit code 2).

## Notes

- `oracle.py`, `suite/`, `persona.md` (and the opener text of
  `prompt.md`) are duplicated in both baseline arms and in
  `cases/flow/csvq-grill/`, as case file references must stay inside
  the case directory -- keep the copies in sync when editing.
- `plan-mode` uses the case key `permissionMode: plan` (see
  `TESTS.md`), which auto-approves the session's `ExitPlanMode` call
  and then switches to `acceptEdits`.
- Expected ordering: `one-shot <= plan-mode <= ase-grill` in hidden-test
  score, at increasing cost and duration -- whether the delta justifies
  the extra cost *is* the benchmark's answer.
