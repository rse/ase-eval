probe/getopt-error
==================

`ase-meta-mint --bogus test harness fixture`, 3 runs, at least 2 must pass, budget $1.00 per run.

## Objective

Checks the error path of option parsing that all ASE skills share. The
skill must pass its arguments to the MCP tool `ase_getopt`, which
rejects the unknown option `--bogus`. The skill must then report the
failure with the getopt error template
(`⧉ **ASE**: ✪ skill: **<skill>**, ▶ ERROR: option parsing failed: **<text>**`)
and stop before it mints anything. A weaker model tends to skip
`ase_getopt`, ignore its error, or keep going anyway.

## Failures Uncovered

-   **Option parsing skipped (options guessed, unknown option silently
    dropped)**: caught by `toolSequence` with `mode: prefix`, which
    demands `ase_getopt` as the first MCP call.
-   **Error not reported or not in the template's wording**: caught by
    `regex` on `ERROR: option parsing failed`.
-   **Skill continues after the parsing error and mints a UUID anyway**:
    caught by `regex` with `not` on the UUID pattern.
-   **Behavior not stable across runs**: caught by `runs: 3` with
    `minPass: 2`.

This case has no `notErrored` oracle, because the failed `ase_getopt`
call is the expected path. Only the text of the final output is
checked.

## Artifacts

Each `results/<timestamp>/probe/getopt-error/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the `ase_getopt` call, the tool
    error, and the error line
-   `result.json`: the outcome of each oracle

The case writes no project files. The general artifact table is in
[`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=probe/getopt-error
```

Input: the prompt `/ase:ase-meta-mint --bogus test harness fixture` in
an empty sandbox. Excerpt from
`results/2026-11-16T12-01-24/probe/getopt-error/run-1/transcript.md`
(`claude-opus-5-5`, 3/3 runs passed):

```
**TOOL** `mcp__plugin_ase_ase__ase_getopt`: {"name":"ase-meta-mint",
  "spec":"--help|-h --type|-t=(uuid|sha1|nanoid|const|var|class|func|path|name) --count|-c=1",
  "args":"--bogus test harness fixture"}

**TOOL FAILED**: ERROR: error: unknown option '--bogus'

**ASSISTANT**:
⧉ **ASE**: ✪ skill: **ase-meta-mint**, ▶ ERROR: option parsing failed: **unknown option '--bogus'**
⧉ **ASE**: ✪ skill: **ase-meta-mint**, ▶ status: **skill finished**

**RESULT**: success (turns: 3, cost: $0.3569)
```

Oracle result from `result.json`:

```
{"kind": "regex", "pass": true, "detail": "all patterns satisfied"}
```
