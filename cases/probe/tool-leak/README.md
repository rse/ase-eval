probe/tool-leak
===============

`ase-meta-mint --type uuid gateway tool call probe`, 3 runs, at least 2
must pass, budget $1.00 per run.

## Objective

Checks that the model gateway translates tool calls correctly. The
skill forces one MCP tool call (`ase_mint`), so any UUID in the output
proves an *executed* call. A gateway with an outdated adapter for a
model's native tool-call format instead passes the raw markup through
as assistant *text* -- the call never executes, the session silently
does nothing, and every tool-using case downstream burns its budget for
no result. This probe fails that gateway for cents, before the probe
gate admits the full suite, and its `failHint` prints what to tell the
gateway operator.

## Failures Uncovered

-   **Tool call leaked as text**: caught by the forbidden `regex`
    patterns, which match the native tool-call markers of the common
    model families: `DSML` (DeepSeek v3.2), `<｜tool▁call` (DeepSeek
    v3/R1), `<tool_call>` (Qwen, GLM, Hermes), `<|python_tag|>`
    (Llama 3), `[TOOL_CALLS]` (Mistral), and `<function_calls`
    (Anthropic-style, leaked verbatim).
-   **Tool call dropped entirely**: caught by the required `regex` for
    a UUID -- an unexecuted `ase_mint` call produces none.
-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.

On failure the runner prints the case's `failHint`: the diagnosis, what
to report to the gateway operator, and how to verify independently with
a direct `/v1/messages` request (`tools` + `tool_choice`, with and
without `stream`).

## Artifacts

Each `results/<timestamp>/probe/tool-leak/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the assistant text, where a
    leak is directly visible, and the `ase_mint` call if it executed
-   `result.json`: the outcome of each oracle

The case writes no project files. The general artifact table is in
[`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=probe/tool-leak
```

No recorded run of this case exists yet. The failure class it detects
is real: in the `deepseek.v3.2` run `2026-11-16T18-26-38`, every
session leaked DSML markup, e.g. `review/context-returns/run-3` ends
with this assistant *text* instead of an executed sub-agent call:

```
<｜DSML｜function_calls
<｜DSML｜invoke name="Agent">
<｜DSML｜parameter name="subagent_type" string="true">ase:ase-repo-review</｜DSML｜parameter>
...
```

That session reported "success" having reviewed nothing, and the suite
went on to burn ~$55 before the cost ceiling stopped it. With this
probe in the gate, the run would have ended after roughly $1 with:

```
✘ probe/tool-leak run 1 (24s, $0.3100)
    ✘ regex: forbidden match: DSML
    ↪ hint: raw tool-call markup leaked into the assistant text: the gateway did not translate ...
```
