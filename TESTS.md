
ASE Skill Test Harness: Reference
=================================

The full reference of the harness: CLI, gateways, the case format and
its contract, sandboxing, and artifacts. For a quick start, see
`README.md`; for the diagrams of the program flow, see `ARCHITECTURE.md`.

## CLI

`node --import tsx src/ase-test.ts [options] [globs...]`, also reached
via `npm start test -- <options>` and the `run_*.sh` scripts.

| Option                   | Meaning                                                              |
|--------------------------|----------------------------------------------------------------------|
| `[globs...]`, `-c, --cases <glob...>` | case name globs, e.g. `task/*` (default: all cases)     |
| `-j, --jobs <n>`         | parallel runs (default: `$ASE_TEST_JOBS`, else `4`)                  |
| `-l, --list`             | list the discovered cases and exit (free)                            |
| `-d, --describe`         | show input, fixture, simulator, and oracles of the cases (free)      |
| `-k, --keep`             | keep the sandboxes of all runs                                       |
| `-K, --keep-failed`      | keep the sandboxes of failed runs                                    |
| `-m, --max-cost-usd <n>` | global cost ceiling in USD (default: `20`)                           |
| `-r, --results <dir>`    | results directory (default: `results/<timestamp>`)                   |
| `-C, --cases-dir <dir>`  | cases directory (default: `cases`; e.g. `uplift` for the uplift benchmark) |
| `--llm <file>`           | gateway profile (default: `$ASE_TEST_LLM`)                           |

`run_all_tests.sh` additionally takes `--force-model <model>`, which
forces the session, sub-agent, judge, and simulator models onto one
model (via `ASE_TEST_FORCE_MODEL`, `ASE_TEST_MODEL`,
`ASE_TEST_JUDGE_MODEL`, `ASE_TEST_SIM_MODEL`, and the `ANTHROPIC_*MODEL`
variables). `run_all_tests_local.sh` does not take it, so combine both
via `./run_all_tests.sh --force-model <model> --llm=<profile>`.

Both run scripts gate a full run: without a case selection (globs,
`-c`/`--cases`, `-l`, `-d`), they first run the probe cases (`probe/*`)
and run the remaining cases (`!probe/*`) only if all probes pass, else
they exit with the exit code of the probe phase. Each phase is its own
harness invocation, with its own results directory (`<dir>/probe` and
`<dir>/suite` for `-r <dir>`) and its own `--max-cost-usd` ceiling. The
script option `--no-probe-gate` runs all cases in one invocation.

Further `etc/stx.conf` targets: `lint`, `test-agent` (the `ase agent`
end-to-end tests, see `agent/README.md`), `review-selftest` and
`review-check-language` (the free self-checks of the review benchmark,
see `docs/review/README.md`), `clean`, and `distclean`.

> **Notice:** *stx* treats every bare word after the target name as
> another target name, so with `npm start test` case globs and detached
> option values get lost (`-c 'meta/*'` fails). Use the `=` form
> (`--cases='meta/*'`, `--jobs=8`) or call `node --import tsx
> src/ase-test.ts` (or the run scripts) directly.

## Exit Codes

| Code | Meaning                                                                                   |
|------|-------------------------------------------------------------------------------------------|
| `0`  | all cases passed                                                                          |
| `1`  | a case failed its pass@k threshold, or no case matched the globs                          |
| `2`  | cost ceiling hit (wins over `1`), an infrastructure error or skipped run, or a preflight error (missing profile, unbuilt tool, no credentials, no `python3` for a `suite` oracle, invalid `--jobs`/`--max-cost-usd`) |

## Third-Party Gateways

The whole harness (sessions, judges, simulator) can be routed to any
Anthropic-compatible gateway, e.g. a [LiteLLM](https://docs.litellm.ai)
proxy in front of a locally served model, via an env-file profile:

```
npm start test -- --llm=etc/llm-local.env --cases=meta/mint-uuid
```

See `etc/llm-local.env.sample` for the format. The harness loads the
profile into its own environment (already exported variables win) and
passes into the sandbox only `ANTHROPIC_BASE_URL`,
`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_MODEL`,
`ANTHROPIC_DEFAULT_<X>_MODEL`, and the three tuning variables
`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`, and
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (plus the credential, see
"Sandboxing"). A profile can also set `ASE_TEST_JOBS`, e.g. `1` to
serialize the runs for a single local model.

Model names are not remapped: the defaults (`claude-haiku-5-5` for judge
and simulator) and per-case `turns.model` reach the gateway as-is. So
either alias the `claude-*` names onto the local model in the gateway
(in LiteLLM: several `model_name` entries pointing to one deployment),
or set `ASE_TEST_MODEL`, `ASE_TEST_JUDGE_MODEL`, and `ASE_TEST_SIM_MODEL`
in the profile (`ASE_TEST_FORCE_MODEL` even overrides `turns.model`).

Caveats: a full local run can take more than an hour; the reported
costs (and with them `budget.maxUsd` and `--max-cost-usd`) are
meaningless for models unknown to the agent tool; a small local judge
is markedly weaker (consider a stronger `ASE_TEST_JUDGE_MODEL`). The
startup line prints the active `endpoint:`. `LOCAL_SETUP.md` shows one
complete example setup.

## Cases

A case is a directory `cases/<group>/<name>/` with a `case.yaml`; it is
discovered as `<group>/<name>`. All file references are relative to the
case directory and must stay inside it. A `README.md` next to it
documents objective, uncovered failures, artifacts, and an example run;
it is never copied into the sandbox. Unknown keys are errors, and
every case is validated (including its regular expressions and
simulator scripts) before any session starts. `src/ase-test-case.ts`
holds the authoritative schema.

| Key               | Meaning                                                                                       |
|-------------------|-----------------------------------------------------------------------------------------------|
| `skill`, `args`   | the skill invoked as `/ase:<skill> <args>`                                                     |
| `promptFile`      | instead of `skill`: a file holding a free-text prompt                                          |
| `stages`          | instead of `skill`: a list of skill invocations (see "Staged Cases")                           |
| `runs`, `minPass` | number of runs and the pass@k threshold                                                        |
| `failHint`        | guidance printed below every failed run of the case, e.g. what to report to a gateway operator |
| `timeoutSec`, `budget.maxUsd` | wall-clock limit and cost budget of one run                                        |
| `fixture`         | `git` (init and commit the project), `config` (written to `.ase/config.yaml`), `tasks` (task plan files seeded into `.ase/task/`), `lifecycle` (of the seeded store), `files` (a file tree copied into the project), `change` (see below) |
| `turns`           | interactive session: `simulator` (`scripted` with `script`, or `llm` with `persona`), `model`, `maxTurns` |
| `disallowedTools` | tools the session must not use, e.g. `[ Edit, Write ]`                                         |
| `permissionMode`  | `plan` starts the session in Claude Code plan mode; its `ExitPlanMode` call is auto-approved and switches to `acceptEdits` (single-session cases only) |
| `oracles`         | the checks deciding the verdict (at least one)                                                 |

`fixture.change` (`files`, `delete`, `message`; requires `fixture.git`)
adds a second commit on top of the base commit: the tree `files`
overlaid onto the project, the paths listed in the file `delete`
removed, committed with `message`. Both commits get neutral messages and
fixed dates; the change commit is the baseline of the `gitDiff` oracle.

## Oracles

| Oracle       | Fields                                                     | Passes when                                                                 |
|--------------|------------------------------------------------------------|-----------------------------------------------------------------------------|
| `notErrored` | `true`                                                     | the session succeeded and the skill printed no `▶ ERROR:` line             |
| `verdict`    | `label`, `expect`                                          | the last verdict word after `label` equals `expect`                        |
| `regex`      | `in`, `file`, `flags`, `match`, `not`                      | all `match` patterns match and no `not` pattern matches the target          |
| `fileExists` | path or list of paths                                      | all files exist in the project                                              |
| `gitDiff`    | `empty`, `changed`, `unchanged`, `mustMatch`, `mustNotMatch` | the changeset diff against the fixture commit satisfies all fields        |
| `taskStore`  | `id`, `exists`, `status`, `titleMatch`, `bodyMatch`, `count` | the task store (`.ase/task/`) satisfies all fields                        |
| `toolSequence` | `calls`, `mode`, `only`                                  | the tool calls matching `only` (default `^mcp__`), matched by their name suffix after the last `__`, equal `calls` (`mode: exact`) resp. contain them in order (`subsequence`, the default) |
| `textMetric` | `in`, `file`, `min`/`maxChars`, `min`/`maxWords`           | the target's length is within the bounds                                    |
| `exec`       | `command`, `reference`, `stdin`, `timeoutSec`              | `command` (in the project) prints the same stdout as `reference` (in the case directory) for every `stdin` vector, trailing whitespace ignored |
| `suite`      | `dir`, `timeoutSec`                                        | the hidden Python suite `dir`, copied into the project only after the last session and the diff, runs via `python3 -m unittest discover` with every test passed |
| `rubric`     | `file`, `threshold`, `votes`                               | the majority of LLM judge votes on the output reaches `threshold`          |
| `similar`    | `expected`, `in`, `id`, `threshold`, `votes`               | the majority of LLM judge votes on the semantic similarity of the target to the golden file reaches `threshold` |
| `review`     | `expected`, `thresholds`, `in`                             | the `ase-repo-review` findings, scored by `src/review/lib/`, meet every threshold of this single run (see below) |

Targets (`in`): `lastMessage` is the last assistant text block, `output`
all assistant text, `dialog` the user/assistant texts without tool
calls, `file` a project file (with `file:`), `taskBody` the body of a
task plan (with `id:`, `similar` only). A missing file or task fails the
oracle; `review` scores an empty text instead. A judge whose votes are
mostly unparsable reports a malfunction instead of a quality failure.

The `review` oracle fails on an unparseable review, on a tool call
reaching into `cases/review/`, `src/review/`, a `solution/` folder, or
the ASE repository outside `plugin/` and `tool/` (contamination), and on
a missed threshold. A case with a `review` oracle is rejected at load
time if its fixture or change message contains a hinting term. The
review cases live in `cases/review/<name>/` (see `docs/review/README.md`).

## Contract

| Key                                       | Default            | Note                                                          |
|-------------------------------------------|--------------------|---------------------------------------------------------------|
| `runs`                                    | `1`                |                                                               |
| `minPass`                                 | `runs`             | i.e., by default *all* runs must pass                         |
| `timeoutSec`                              | `300`              | wall-clock limit of one session                               |
| `budget.maxUsd`                           | `2.00`             | per run, see "Budget and Retries"                             |
| `fixture.lifecycle`                       | `solo`             | lifecycle of the seeded task store                            |
| `turns.maxTurns`                          | `16`               | *user* turns; the agentic turn cap is 4×, resp. 32 single-shot |
| `turns.model`                             | `claude-haiku-5-5` | `llm` simulator only; precedence: `$ASE_TEST_FORCE_MODEL`, `turns.model`, `$ASE_TEST_SIM_MODEL`, default |
| `in` (`regex`, `textMetric`, `similar`, `review`) | `lastMessage` |                                                        |
| `disallowedTools`                         | `[]`               | a single-shot session also always disallows `AskUserQuestion` |
| `regex.flags`                             | `m`                | a JavaScript regex: no inline `(?i)`                          |
| `threshold`/`votes` (`rubric`, `similar`) | `0.7`/`3`          | judge model `$ASE_TEST_JUDGE_MODEL`, else `claude-haiku-5-5`  |
| `exec.timeoutSec`                         | `10`               | per command execution                                         |
| `suite.timeoutSec`                        | `120`              | for the whole suite run                                       |
| `stages[].timeoutSec`                     | `300`              | per stage, a staged case sums them up                         |
| `stages[].budget.maxUsd`                  | `2.00`             | per stage, a staged case sums them up                         |

### Staged Cases

A staged case declares `stages` *instead* of `skill`/`promptFile` and
carries `turns`, `timeoutSec`, `budget`, and `disallowedTools` per stage
only. Each stage has `skill`, `args`, and optionally `turns`,
`timeoutSec`, `budget`, `disallowedTools`, and `oracles`. Its `args` may
reference `{{stage<N>.lastMessage}}` of an earlier stage. All stages run
one after the other in the *same* sandbox, each in its own session. The
stage oracles are *diagnostic* (reported as `stage<N>/<kind>`, marked
`◦`), the top-level oracles alone decide the verdict, and `suite` is
top-level only. An errored stage skips the remaining stages and fails
the run without evaluating the top-level oracles. Example:
`cases/flow/brainstorm-grill-implement/`.

### Simulators

-   **Scripted** (`answers.yaml`): `rules` (`when` regex, `answer`) are
    matched against a question plus its option labels (`AskUserQuestion`)
    resp. against the last assistant message (free-text turn). An
    unmatched question takes `default`, else the first option, else
    `proceed`. A free-text turn ends the session when `end` matches or
    when no rule matches and there is no `default`.
-   **LLM** (`persona.md`): a model plays the user along the persona and
    ends the session by replying `<<END>>` (or nothing).

Interactive sessions allow every permission request; single-shot
sessions use the automatic permission mode of the agent tool.

### Budget and Retries

-   The agent tool aborts a session at `budget.maxUsd` itself, and a run
    exceeding it fails even when all its oracles pass.
-   The global `--max-cost-usd` ceiling stops scheduling further runs
    (in-flight runs complete, the rest is `skipped`). A run whose cost is
    inaccurate (timeout or crash before the final result message) is
    booked at its full budget against the ceiling.
-   A run is retried exactly once, into `run-<n>-retry/`, when its
    session crashed before the skill produced any output or the attempt
    threw (e.g. the sandbox creation failed), and only while the ceiling
    is not hit. A timeout is never retried. The reported cost sums both
    attempts.

## Sandboxing

Every run gets a private sandbox, so runs are parallel-safe:

-   a private HOME with XDG directories, credentials, and a Claude
    `settings.json` with `disableClaudeAiConnectors`
-   a private project directory with the fixture, its own `.ase/` state,
    task store, and service port
-   an environment without agent tool, ASE, tmux, and Copilot state and
    without common credential variables, plus `tool/bin` on the `PATH`,
    `ASE_HEADLESS=true`, exactly one agent tool credential
    (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, or the copied
    `~/.claude/.credentials.json`), and the gateway variables above

The teardown runs `ase service stop` and removes the sandbox, unless
`-k`/`-K` keeps it (its path is then written to `sandbox.txt`).

## Artifacts

Per run, `results/<timestamp>/<group>/<name>/run-<n>/` holds:

| File                         | Content                                                         |
|------------------------------|-----------------------------------------------------------------|
| `transcript.jsonl`           | raw SDK messages                                                |
| `transcript.md`              | decoded transcript (texts, tool calls, results)                 |
| `stderr.log`                 | stderr of the agent tool                                        |
| `diff.patch`                 | changeset diff of the project (if not empty)                    |
| `files/`                     | final state of every added or modified project file             |
| `taskstore/`                 | copy of `.ase/task/`                                            |
| `suite.log`, `review.log`    | full output of a `suite` oracle, resp. the review text          |
| `result.json`                | verdict, session data, and oracle results (with `metrics`)      |
| `sandbox.txt`                | path of a kept sandbox                                          |

A staged run prefixes the transcript and stderr files with `stage-<N>-`
and adds the per-stage results to `result.json`. The `summary.json` of
the invocation holds all runs plus the provenance (endpoint, models,
plugin commit and version, SDK and Node.js versions). Results are never
committed.

## Comparing Runs

```
./generate_comparison.sh                            # compare all summaries under results/ (free)
./generate_comparison.sh --add ../some-run-dir      # include an extra run directory
npm start compare -- --results=other --out=/tmp     # the same via stx (option values need the "=" form)
```

`src/ase-test-compare.ts` collects every `results/*/summary.json`
(including the nested uplift summaries) plus the `--add` directories and
prints a cases × models matrix, a case-groups × models matrix
(cells: passed/runs, mean cost, mean duration; skipped runs excluded),
and a runs-over-time table (timestamp, model, plugin version resp.
commit, pass counts, cost, duration). It also writes `COMPARISON.md` and
a self-contained `COMPARISON.html` (sortable tables, pass-rate and cost
trend charts) into the repository root. The model of a summary is the
forced model, else the most frequent per-run model; the version is the
`pluginVersion` meta field (recorded by the harness from now on), with
the `pluginCommit` prefix as the fallback for older summaries.
