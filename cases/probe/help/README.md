probe/help
==========

`ase-meta-mint --help`, 3 runs, at least 2 must pass, budget $1.00 per run.

## Objective

Checks the `--help` short-circuit that all ASE skills share. With
`--help`, the skill must print its own manual page (`help.md`) word for
word and stop, without running its workflow. A weaker model tends to
summarize the page instead of printing it, or to carry on and mint an
identifier anyway.

## Failures Uncovered

-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.
-   **Manual page summarized or paraphrased instead of printed verbatim**:
    caught by `regex` on the headings `## NAME` and `## SYNOPSIS`.
-   **Manual page truncated before the option list**: caught by `regex`
    on `--count`.
-   **Include directive echoed instead of resolved** (e.g. the literal
    `@.../ase-meta-mint/help.md`): caught by `regex` with `not` on
    `@\S*help\.md`.
-   **Workflow runs anyway and mints a UUID**: caught by `regex` with
    `not` on the UUID pattern.
-   **Behavior not stable across runs**: caught by `runs: 3` with
    `minPass: 2`.

## Artifacts

Each `results/<timestamp>/probe/help/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the `help.md` read and the
    printed manual page
-   `result.json`: the outcome of each oracle

The case writes no project files. The general artifact table is in
[`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=probe/help
```

Input: the prompt `/ase:ase-meta-mint --help` in an empty sandbox.
Excerpt from `results/2026-11-16T12-01-24/probe/help/run-1/transcript.md`
(`claude-opus-5-5`, 3/3 runs passed; the full page is 133 lines):

```
**TOOL** `Read`: {"file_path":"/home/severin/ase/plugin/skills/ase-meta-mint/help.md"}

**ASSISTANT**:
## NAME
`ase-meta-mint` - Mint an Identifier or Name

## SYNOPSIS
`ase-meta-mint`
    [`--help`|`-h`]
    [`--type`|`-t` `uuid`|`sha1`|`nanoid`|`const`|`var`|`class`|`func`|`path`|`name`]
    [`--count`|`-c` *count*]
    [*hint*]
[...]
## SEE ALSO
[`ase-task-id`](../ase-task-id/help.md), [`ase-meta-brainstorm`](...), [...]

**RESULT**: success (turns: 2, cost: $0.4630)
```

Oracle results from `result.json`:

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
```
