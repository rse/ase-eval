
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
| `-m, --max-cost-usd <n>` | global cost ceiling in USD (default: summed budgets of the scheduled cases + 10%) |
| `-b, --budget-factor <n>` | factor on all per-run budgets (default: `$ASE_TEST_BUDGET_FACTOR`, else `1`) |
| `-t, --time-factor <n>`  | factor on all case and stage timeouts (default: `$ASE_TEST_TIME_FACTOR`, else `1`) |
| `--allow-stale`          | run even if `tool/dst` is older than `tool/src`                      |
| `-r, --results <dir>`    | results directory (default: `results/<timestamp>`)                   |
| `-C, --cases-dir <dir>`  | cases directory (default: `cases`; e.g. `uplift` for the uplift benchmark) |
| `--llm <file>`           | gateway profile (default: `$ASE_TEST_LLM`)                           |
| `--tool-search <mode>`   | `off` loads all MCP tool schemas upfront (`ENABLE_TOOL_SEARCH=false` in the sessions) instead of deferring them behind `ToolSearch` (default: `$ASE_TEST_TOOL_SEARCH`, else `on`) |

`run_all_tests.sh` additionally takes `--force-model <model>`, which
forces the session, sub-agent, judge, and simulator models onto one
model (via `ASE_TEST_SIM_FORCE`, `ASE_TEST_MODEL`,
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
| `2`  | cost ceiling hit (wins over `1`), an incomplete case, an infrastructure error or skipped run, or a preflight error (missing profile, unbuilt or stale tool, no credentials, no `python3` for a `suite` oracle, invalid `--jobs`/`--max-cost-usd`/`--budget-factor`/`--time-factor`) |
| `130` | interrupted (SIGINT/SIGTERM): live sessions aborted, sandboxes torn down, partial `summary.json` written |

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
in the profile (`ASE_TEST_SIM_FORCE` even overrides `turns.model`).

Caveats: a full local run can take more than an hour; the reported
costs (and with them `budget.maxUsd` and `--max-cost-usd`) are
fallback-priced for models unknown to the agent tool (`costBasis:
"unpriced"` in the summary), unless `etc/pricing.yaml` lists their real
token prices (`costBasis: "table"`, see "Budget and Retries"); a small local judge
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
| `maxAgentTurns`   | cap of the agentic turns of one session, a runaway guard cheaper than dollars for uncached models |
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
| `toolSequence` | `calls`, `mode`, `only`                                  | the tool calls matching `only` (default `^mcp__`), matched by their name suffix after the last `__`, equal `calls` (`mode: exact`), start with them (`prefix`), resp. contain them in order (`subsequence`, the default) |
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
| `fixture.nodeModules`                     | `[]`               | packages of the harness `node_modules/` (incl. their `.bin` entries) symlinked into the project, Git-excluded, e.g. `[ typescript ]` for a fixture declaring but not installing it |
| `turns.maxTurns`                          | `16`               | *user* turns; the agentic turn cap is 4×, resp. 32 single-shot |
| `maxAgentTurns`                           | see `turns.maxTurns` | overrides the agentic turn cap (also per stage)             |
| `turns.model`                             | `claude-haiku-5-5` | `llm` simulator only; precedence: `$ASE_TEST_SIM_FORCE`, `turns.model`, `$ASE_TEST_SIM_MODEL`, default |
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
    exceeding it fails even when all its oracles pass. Such an abort is
    reported as `session error: error_max_budget_usd` and never retried.
-   `--budget-factor` scales all budgets, e.g. for gateway models
    without prompt caching; `launch_tests.sh` sets
    `ASE_TEST_BUDGET_FACTOR=3` for every non-Anthropic model.
-   A model the agent tool cannot price (`costBasis: "unknown"` in its
    result messages) is booked at fallback prices ($4/M input, $20/M
    output). With an entry in `etc/pricing.yaml`, the harness recomputes
    its cost from the token usage, scales the SDK budget cap up to a
    mere backstop, and aborts the session itself once the table-priced
    usage exceeds `budget.maxUsd`. A model without an entry is flagged
    at startup and as `unpriced` per run.
-   `--time-factor` scales all timeouts; `launch_tests.sh` sets
    `ASE_TEST_TIME_FACTOR=2` for every non-Anthropic model. The time the
    simulator spends composing an answer does not count against the
    timeout (nor the stall watchdog).
-   Runs are scheduled coverage-first: every first run of all cases
    (cheapest case first) before any second run, so a hit ceiling still
    leaves an evaluated run of as many cases as possible. A case which
    missed `minPass` only for lack of evaluated runs (skipped or errored)
    is reported as `INCOMPLETE`, not `FAIL`.
-   The simulator and judge completions are booked against the ceiling,
    too (`sideUsd` in the summary). A run whose booked cost differs from
    its measured one shows both.
-   The global cost ceiling stops scheduling further runs (in-flight
    runs complete, the rest is `skipped`). It defaults to the summed
    (already `--budget-factor`-scaled) budgets of the scheduled cases
    plus 10% headroom for retried attempts, so it grows with the suite
    and only guards against runaway costs; an explicit `--max-cost-usd`,
    scaled by `--budget-factor`, caps it harder. The resolved ceiling
    and its origin are printed at startup. A run whose cost is inaccurate (timeout, stall, or crash
    before the final result message) is booked at the mean accurate cost
    so far (capped by, and before the first accurate run at, its budget),
    and at its lower bound (usually `0`) if it never produced an
    assistant message (e.g. a crash while loading the gateway settings).
-   A session without any *progress* for `$ASE_TEST_STALL_SEC` seconds
    (default `120`, `0` disables it) is aborted as a *stall* -- e.g. a
    hanging gateway stream -- and is an infrastructure error, retried
    once. Progress is any regular SDK message and any streamed event
    except a keep-alive `ping`, while thinking (streamed thinking deltas
    and `thinking_tokens` estimates) counts only once it adds up to
    `$ASE_TEST_STALL_MIN_TOKENS` tokens (default `50`), so a stream
    trickling a few tokens for minutes is caught, too. Every message of
    `transcript.jsonl` carries its receive time as `_receivedAt`. Once a
    minute, a `{"type":"harness","subtype":"stream_heartbeat"}` line records
    the streamed partial messages (counts per event type, characters, and
    the tail of the streamed text). A stall wins over a later timeout, and
    `result.json` records `stalled`, `stallAt`, `abortAt`, `sdkHung`, and
    `apiRetries`. An SDK which does not end its stream within 15 s after an
    abort is left behind (`sdkHung`), so no session outlasts its abort.
-   A run which timed out, stalled, or hit the turn cap while the agent tool
    itself was retrying failed API calls (`system/api_retry`, e.g. after an
    HTTP 504 of the gateway, the last one at most 180 s before its end) is an
    infrastructure error (`gateway`) and retried after the outage pause; an
    `api_retry` never counts as progress of the stall watchdog.
-   After 3 consecutive infrastructure errors (other than gateway
    outages), the workers pause before scheduling further runs (60 s,
    doubling up to 300 s).
-   A *gateway outage* (`Couldn't load settings from Cloud gateway`,
    `API Error: 5xx`/`529`, `Service Temporarily Unavailable`,
    `overloaded_error`) pauses *all* workers of *all* runners of a
    launcher (shared through `$ASE_TEST_OUTAGE_FILE`, which the launcher
    sets to `results/.outage-<timestamp>`, else `<results>/.outage`):
    60 s, doubling per consecutive outage up to 300 s, plus a jitter;
    every attempt waits for its end, and the first ordinary run resets
    the streak. A transient error (gateway, API, simulator) is retried
    only after at least 30 s plus a jitter.
-   Every infrastructure error carries its kind (`infraKind` in the
    summary, `⚠ infra (<kind>)` in the console, `+N infra (kinds)` in
    the comparison): `gateway`, `api`, `mcp`, `sim`, `stall`, `eval`, or
    `crash`.
-   The workers start staggered: the pool waits `$ASE_TEST_START_DELAY`
    seconds (the launcher sets `20 × runner index`), and worker `i`
    another `i × $ASE_TEST_STAGGER_SEC` seconds (default `10`), so a batch does not open all its sessions at
    the same instant.
-   A run is retried exactly once, into `run-<n>-retry/`, when its
    session crashed before the skill produced any output or the attempt
    threw (e.g. the sandbox creation failed), and only while the ceiling
    is not hit. A timeout is never retried. The reported cost sums both
    attempts. A session whose ASE MCP server failed to connect is an
    infrastructure error and retried, too. An API refusal (e.g. HTTP 403
    for an inaccessible model) is an infrastructure error, retried only
    for HTTP 429 and 5xx. A failed simulator (e.g. a completion timeout)
    is an infrastructure error and retried, too. A failed evaluation
    (e.g. a judge timeout) retries the oracles alone, up to 3 attempts,
    and then reports the run as an infrastructure `error`, never as a
    model failure. A *failed* run whose session saw a gateway or server
    error (e.g. a sub-agent hit by an HTTP 503) is an infrastructure
    error (`api`) and retried, while a passed run stays passed.
-   A safeguard refusal of the reference model (`safeguards flagged this
    message`) as judge or simulator is repeated once with the fallback
    reference model `$ASE_TEST_REF_FALLBACK` (the launcher's
    `--ref-fallback`, default `eu.anthropic.claude-sonnet-5`), and never
    retried with the same model; the summary counts the fallbacks in
    `meta.refFallbacks`.
-   A session calling `ase_task_save` more than 5 times gets the
    diagnostic `saveLoop`.
-   `summary.json` is rewritten after every finished run (`aborted:
    "incomplete"` until the end), and an interrupt (SIGINT/SIGTERM)
    aborts all live sessions, tears down their sandboxes, and writes the
    final summary with the unfinished runs as `skipped`; a second
    interrupt exits immediately. The summary is written before the
    console report of a run, so a failing console write (e.g. a crashed
    launcher) never loses a finished run.
-   `npm start clean-sandboxes` (`etc/clean-sandboxes.sh [--dry-run]`)
    removes the leftover `/tmp/ase-test-*` sandboxes of killed runs
    (older than one minute) and stops their `ase service` processes.
-   A harness run warns at its start about another live harness run on the
    same endpoint which does not share its gateway outage state (i.e. which
    was not started by the same launcher), through the lock files
    `results/.running-<endpoint-hash>-<pid>`.

## Sandboxing

Every run gets a private sandbox, so runs are parallel-safe:

-   a private HOME with XDG directories, credentials, and a Claude
    `settings.json` with `disableClaudeAiConnectors` and `Read` deny
    rules sealing `tool/src/` and the harness (the answer keys) against
    `Read`/`Grep`/`Glob` -- `Bash` remains a known gap
-   a pre-started ASE service and `MCP_TIMEOUT=120000` (unless set), so
    the MCP server connects even under many parallel cold starts
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

## Launching Tests Interactively

`./launch_tests.sh` (or `npm start launch`) first offers a checkbox list
of all test cases (nothing preselected, the first entry selects all),
then a checkbox list of the models of the live `claude` model listing
(nothing preselected, no select-all), confirms the cost, and runs the
selected cases with every selected model: one runner process per model
in parallel, each into its own `results/<timestamp>-<model>/` directory
(child output in its `launcher.log`), with a live progress line per
model. The explicit case selection bypasses the probe gate. The
session and its sub-agents run on the selected model, while the judge
and the simulator stay on one fixed reference model for all models
(`--ref-model <id>`, default `$ASE_TEST_REF_MODEL`, else
`eu.anthropic.claude-opus-5-5`, with the fallback `--ref-fallback <id>`
after a safeguard refusal), so no model grades itself or plays its
own user. The runners share one gateway outage state and start 20 s
apart; the progress lines are redrawn in place at most 5 times per
second, cut to the terminal width. A Ctrl-C reaches every runner, and the launcher waits for
their teardown and still refreshes the comparison. Extra
options (e.g. `--jobs=6`, `-K`, `--max-cost-usd=50`) are passed through
to every runner; a `--max-cost-usd` ceiling therefore applies per model
runner, not to the whole matrix. Afterwards the comparison report is refreshed (see
below); the exit code is the worst runner exit code.

Each interactive step can be skipped with a launcher option:
`--tests <globs>` (comma-separated case globs, resolved like the harness
case globs), `--models <ids>` (comma-separated model ids, taken as given
-- use resolved ids, not UI aliases), and `--yes` (skip the cost
confirmation). With all three given, no terminal interaction is needed.
After the final PASS/FAIL lines the launcher prints a `repeat:` line:
one copyable command (`./launch_tests.sh --tests ... --models ... --ref-model ... --ref-fallback ... --yes`
plus the pass-through options) that repeats the exact run.

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
