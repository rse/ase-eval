
ASE Skill Test Harness: Architecture
====================================

How the harness is built and how it executes a test, as diagrams, plus
which parts are framework and where the harness touches **ASE**. For
the case format and all defaults, see `TESTS.md`; for adding a test,
see `README.md`.

## 1. Overall Architecture

```mermaid
flowchart LR
    RUN["Harness: runner<br/>src/ase-test.ts"] -->|starts session| SDK["Framework: Claude Agent SDK"]
    SIM["Harness: user simulator"] -->|answers| RUN
    SDK --> API["Model API<br/>(Anthropic or gateway)"]
    SDK -->|loads| PL["ASE: plugin/"]
    PL -->|MCP: ase mcp| TL["ASE: built tool/<br/>(tool/bin on PATH)"]
    PL -->|skills write| SB["Sandbox project"]
    O["Harness: oracles"] -->|inspect| SB
    O -->|LLM judges| API
    SIM -->|LLM simulator| API
```

-   **Harness** (`src/`): loads the cases, schedules the runs, drives
    the sessions, simulates the user of interactive skills, and
    evaluates the outcome.
-   **Framework**: the *Claude Agent SDK* ships its own Claude Code
    runtime and does the agent work against the Anthropic API or an
    Anthropic-compatible gateway.
-   **ASE under test**: the session loads `plugin/` straight from the
    surrounding ASE working copy, and the plugin starts the *built*
    `tool/` (the `ase` MCP server and service).

> **Notice:** after changing `tool/src/`, rebuild the tool
> (`cd ../tool && npm start build`), else the tests run stale code.

## 2. Launch Chain

```mermaid
flowchart LR
    N["npm start test -- ..."] --> X["stx: etc/stx.conf"] --> E["node --import tsx src/ase-test.ts"]
    S["run_all_tests.sh<br/>run_all_tests_local.sh"] --> E
```

*stx* is the task runner (`npm start <target>` runs a target of
`etc/stx.conf`); it eats bare words and detached option values, so use
`--cases=<glob>` (see `TESTS.md`). `--import tsx` transpiles the
TypeScript on import, so the harness has no build step (`tsc` only
type-checks it in `npm start lint`).

## 3. One Invocation

```mermaid
flowchart TD
    A["Load and validate all cases/**/case.yaml<br/>(schema, files, regexes, scripts, review leak check)"] --> B["Filter by globs; --list / --describe exit here"]
    B --> C["Preflight: gateway profile, built tool,<br/>credentials, python3 for suite"]
    C --> D["Run pool: every case x run,<br/>--jobs in parallel"]
    D --> E["Per case: pass@k (minPass)"]
    E --> F["Console summary + summary.json"]
    F --> G{"Exit code"}
    G -->|"ceiling hit"| X2["2"]
    G -->|"else: a case failed"| X1["1"]
    G -->|"else: error or skipped run"| X3["2"]
    G -->|"else"| X0["0"]
```

### Scheduling, Retry, and Ceiling

```mermaid
flowchart TD
    Q["Work list: all run 1s, then all run 2s, ...<br/>(cheapest case first per round)"] --> W
    W["Worker takes next run<br/>(after its staggered start)"] --> AB{"Ceiling hit<br/>or interrupted?"}
    AB -->|yes| SK["Mark skipped"]
    AB -->|no| OW["Wait for the end of a<br/>shared gateway outage pause"] --> AT["Attempt 1"]
    AT --> IN{"Infrastructure error?<br/>(crash without skill output, stall,<br/>simulator failure, or the attempt threw)"}
    IN -->|no| DONE["Report run"]
    IN -->|yes| CE{"Ceiling hit?"}
    CE -->|yes| DONE
    CE -->|no| RD["Wait ≥30 s + jitter<br/>(transient errors) and the outage pause"] --> AT2["Attempt 2 into run-n-retry/<br/>(costs of both summed)"] --> DONE
    DONE --> BK["Book cost: measured (table-priced if unpriced),<br/>or an estimate if inaccurate"]
    BK --> CH{"Sessions + simulator/judge<br/>above the ceiling?"}
    CH --> SW["Rewrite summary.json"]
    SW -->|ceiling hit| STOP["Stop scheduling"]
    SW -->|else| W
```

A timeout is never retried, as it is the most expensive failure mode.
A failed evaluation (e.g. a judge timeout) retries only the oracles and
ends as an infrastructure `error`. A gateway error (e.g. `Couldn't load
settings from Cloud gateway`, HTTP 5xx) pauses all workers of all
runners through a shared outage file. A SIGINT/SIGTERM aborts all live
sessions, tears down their sandboxes, and writes the final summary.

## 4. One Run (Attempt)

```mermaid
flowchart TD
    T["Open transcript dir"] --> SB["Create sandbox:<br/>HOME, env, fixture, Git commits"]
    SB --> ST["Next stage (a single-skill case has one)"]
    ST --> SE["Session: /ase:skill args<br/>(stage args may use earlier last messages)"]
    SE --> DG["Staged only: diagnostic stage oracles"]
    DG --> ER{"Stage errored?"}
    ER -->|"no, more stages"| ST
    ER -->|"yes or last stage"| CL{"Classify"}
    CL -->|"crash, no output, no timeout"| IE["error (retryable)"]
    CL -->|"staged and errored"| SF["fail, top-level oracles skipped"]
    CL -->|"else"| EV["Changeset diff, top-level oracles<br/>(hidden suite copied in only now),<br/>budget check"]
    EV --> PF["pass if every non-diagnostic oracle passed"]
    IE --> FN
    SF --> FN
    PF --> FN["Write artifacts and result.json"]
    FN --> TD["Teardown: ase service stop,<br/>remove sandbox unless -k/-K"]
```

### Multi-Turn Session

A case with `turns` runs a multi-turn session with streaming input; a
case without runs single-shot (`AskUserQuestion` disallowed).

```mermaid
sequenceDiagram
    participant H as Harness
    participant S as Claude Agent SDK
    participant U as Simulator
    H->>S: query() with the first user turn (skill invocation)
    loop until end, error, timeout, or maxTurns
        S->>H: canUseTool(AskUserQuestion)
        H->>U: answers(questions)
        U-->>H: answers
        H-->>S: allow, answers injected
        S->>H: result message (end of agentic turn)
        H->>U: nextTurn(dialog)
        U-->>H: next user message, or end
        H->>S: next user turn (or close the input)
    end
```

### Staged Case

```mermaid
sequenceDiagram
    participant H as Harness
    participant B as Sandbox (shared)
    H->>B: create once (fixture)
    loop each stage
        H->>B: session of stage N (own transcript stage-N-*)
        H->>B: diagnostic oracles of stage N (never decide)
    end
    H->>B: changeset diff
    H->>B: copy hidden suite in, run top-level oracles (decide)
    H->>B: teardown
```

## 5. Choosing Oracles

```mermaid
flowchart TD
    Q["What does the skill produce?"]
    Q --> T["Text output"] --> T1["notErrored, verdict, regex, textMetric;<br/>rubric, similar (LLM judges)"]
    Q --> F["Files or code"] --> F1["fileExists, gitDiff, exec, suite"]
    Q --> P["Task plans"] --> P1["taskStore, similar (taskBody)"]
    Q --> I["Asks the user questions"] --> I1["turns: scripted or llm simulator"]
    Q --> S["A flow of several skills"] --> S1["stages, with diagnostic oracles per stage"]
    Q --> R["A code review of a seeded change"] --> R1["review (cases/review/)"]
```

Prefer the mechanical oracles: they are free and deterministic. Use the
LLM judges (`rubric`, `similar`) only where the quality of free text
matters.

## 6. Framework vs. Harness

| Layer                                               | Role                                                                                         | Owner                  |
|-----------------------------------------------------|----------------------------------------------------------------------------------------------|------------------------|
| Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) | runs the sessions (own Claude Code runtime, plugins, hooks, MCP, permissions, cost), and the judge and simulator completions without an API key (OAuth) | Anthropic (dependency) |
| Anthropic SDK (`@anthropic-ai/sdk`)                 | direct judge and simulator completions with an API key                                       | Anthropic (dependency) |
| `src/*.ts`                                          | discovery, sandboxes, session driver, simulators, oracles, judges, reporting                 | Harness                |
| `src/review/`                                       | scorer and standalone tools of the review benchmark (plain Node.js `.mjs`)                   | Harness                |
| `cases/`                                            | inputs, fixtures, and expected outputs                                                       | Test data              |

## 7. Touchpoints with ASE

The harness never imports ASE code; it drives ASE as a black box.

| Touchpoint                                    | How                                                                                     | Consequence                                                                 |
|-----------------------------------------------|-----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| location                                      | the harness resolves ASE as its parent directory                                        | it must be checked out *directly* inside ASE                                |
| `plugin/`                                     | loaded from the working copy as a local plugin                                          | skill, sub-agent, meta file, and hook changes are tested without `ase setup` |
| `tool/bin/ase`, `tool/dst/`                   | `tool/bin` on the sandbox `PATH`; the plugin starts `ase mcp`, which spawns `ase service` | the *built* tool is tested: rebuild after changing `tool/src/`             |
| `ase service stop`                            | called on teardown                                                                      | stops the background service of the sandbox                                 |
| `.ase/config.yaml`                            | written from `fixture.config`                                                           | coupled to the ASE configuration keys                                       |
| `.ase/task/TASK-*.md`, `PROJECT.yaml`         | fixtures in the task file format; `taskStore` and `taskBody` parse it back              | coupled to the *format* of `tool/src/ase-task-format.ts`, not to its code   |
| skill output conventions (`▶ ERROR:`, verdict words, ...) | matched by the oracles and the infrastructure error classification          | coupled to `plugin/meta/ase-skill.md` and the `SKILL.md` templates          |
| `ase-repo-review` output                      | the verdict and findings table, parsed by the `review` oracle                           | coupled to the output format of that skill                                  |
| `skillErrored`, `verdictOf`, `changesetDiff`, `skillPrompt`, `brief` | copied into `src/ase-test-{oracle,session,transcript}.ts`, with comments naming the originals in `tool/src/ase-agent-runtime-*.ts` | copies drift silently when the originals change |

> **Notice:** the task file format, the skill output wording, and the
> copied helpers are invisible to the build: an ASE change there breaks
> tests without any compile error. Check them first when tests fail
> after an ASE change which "should not" affect them.
