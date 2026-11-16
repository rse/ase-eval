Test Description: `wordcount-python`
====================================

## Purpose

This case tests the autonomous agents of ASE (`ase agent`) end to end
with the runner `pipeline`: the three built-in phase agents
`implementer`, `qualifier`, and `integrator` of the `enterprise`
lifecycle model run one after the other in the foreground
(`--foreground --one-shot`) and drive a single, precisely specified task
headless from `PLANNED` to `INTEGRATED`: a Python clone of the Unix `wc`
command. A black-box test suite then checks the `wordcount.py` on
`master`. The generic steps, runners, and pass criteria are described in
`agent/README.md`.

| File                      | Role                                                          |
|---------------------------|---------------------------------------------------------------|
| `case.json`               | `{ "task": "wordcount", "program": "wordcount.py", "runner": "pipeline" }` |
| `task.md`                 | the task fixture (ASE task format, id `wordcount`, `PLANNED`) |
| `suite/test_wordcount.py` | the test suite (Python `unittest`, standard library only)     |

## Inside the Agents

The agents run further commands, which the test does not issue directly
but exercises indirectly (see `ase man ase-agent` and the definitions in
`tool/src/ase-agent-definition-builtin/`):

| Agent         | Claims        | Activity       | Skill prompt (with the `branch:` changeset of the test)                    | Success       | Failure    |
|---------------|---------------|----------------|----------------------------------------------------------------------------|---------------|------------|
| `implementer` | `PLANNED`     | `IMPLEMENTING` | `/ase:ase-task-implement --next DONE --changeset worktree [--worktree <path>] wordcount` | `IMPLEMENTED` | `STALLED`  |
| `qualifier`   | `IMPLEMENTED` | `QUALIFYING`   | `/ase:ase-repo-review --branch cs-wordcount`                               | `QUALIFIED` (`APPROVE`) | `DECLINED` (`REJECT`) |
| `integrator`  | `QUALIFIED`   | `INTEGRATING`  | `/ase:ase-task-integrate --next DONE --mode squash [--worktree <path>] wordcount` | `INTEGRATED`  | `DEFERRED` |

Along the way, the agents claim the task by a conditional save (status,
tag `ase-agent-<kind>:active`, `Assignee:`) and settle it afterwards,
implement on the branch `cs-wordcount`, checked out as the ASE worktree
`.ase/worktree/cs-wordcount`, store the review verdict as the tag
`ase-agent-qualifier:approve` resp. `:reject`, squash-merge into
`master` with a snapshot attachment of the landed diff, append their log
to the `agent` attachment, and use the on-demand ASE service.

## Coverage

| Area                                                                 | Covered | Notes                                            |
|----------------------------------------------------------------------|---------|--------------------------------------------------|
| `ase setup install --dev`                                            | yes     | into an isolated HOME, from the working copy     |
| `ase config set`, `ase task lifecycle`                               | yes     | `project` scope, local task store                |
| `ase task save --create/status/load`                                 | yes     | default local store `ase:./.ase/task`            |
| `enterprise` lifecycle transitions                                   | yes     | `PLANNED` → ... → `INTEGRATED` (happy path only) |
| `ase agent implementer` (mode `implement`)                           | yes     | `--foreground --one-shot`, `effort-wait=false`   |
| `ase agent qualifier` (mode `qualify`)                               | yes     | verdict parsing and automatic decision           |
| `ase agent integrator` (mode `squash`)                               | yes     | merge into `master`, snapshot attachment         |
| task claiming, tags, assignee handling                               | yes     | single agent per kind, no contention             |
| `branch:` changesets and ASE worktrees                               | yes     | `cs-wordcount` below `.ase/worktree/`            |
| skills `ase-task-implement`, `ase-repo-review`, `ase-task-integrate` | yes     | headless, via the agents                         |
| ASE MCP service (on-demand start, stop)                              | yes     |                                                  |
| agent tools `copilot` / `codex`                                      | opt-in  | only with `--tool copilot` resp. `--tool codex`  |
| `ase agent fleet`, `ase agent relay`                                 | no      | see case `fibonacci-fleet`                       |
| `estimator`, `editor`, `researcher`, `rebooter`, `condenser`         | no      | `estimator` replaced by `effort-wait=false`      |
| `adhoc` agents and definition kinds                                  | no      |                                                  |
| qualifier mode `judge`, implementer mode `draft`, other merge modes  | no      |                                                  |
| `worktree` / `attachment:` changesets                                | no      |                                                  |
| `--repo` clones, remote task stores                                  | no      |                                                  |
| parallelism (`--parallel`), agent pools                              | no      | single task, no `After:` dependencies            |
| interrupts and crash recovery                                        | no      |                                                  |
| failure paths (`STALLED`, `DECLINED`, `DEFERRED`)                    | no      | only detected and reported, never provoked       |
| task board (TUI/web)                                                 | no      |                                                  |

## Test Suite

`suite/test_wordcount.py` runs `wordcount.py` as a subprocess (with the
interpreter running the suite), in a temporary directory with byte-exact
fixture files, and normalizes `\r\n` in the output. It finds the project
through `$AGENT_TEST_PROJECT` (legacy fallback: `$WORDCOUNT_PROJECT`,
else the current directory). All 12 tests have to pass:

| Test                                | Checks                                               |
|-------------------------------------|------------------------------------------------------|
| `test_empty_file`                   | `0 0 0 empty.txt`                                    |
| `test_single_line_without_newline`  | zero lines for text without `\n`                     |
| `test_multi_line`                   | lines, words, characters incl. an empty line         |
| `test_mixed_whitespace`             | tabs and runs of spaces as word separators           |
| `test_unicode_characters`           | characters are code points, not bytes (UTF-8, emoji) |
| `test_crlf_counts_carriage_returns` | `\r` counts as a character, lines count only `\n`    |
| `test_stdin`                        | stdin mode prints no name                            |
| `test_stdin_empty`                  | `0 0 0` for empty stdin                              |
| `test_multiple_files_with_total`    | per-file lines plus a `total` line                   |
| `test_single_file_has_no_total`     | no `total` line for a single file                    |
| `test_missing_file`                 | exit code `1`, message on stderr, no stdout          |
| `test_missing_file_among_others`    | missing file skipped, others and total still printed |
