/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as path from "node:path"

import { query } from "@anthropic-ai/claude-agent-sdk"
import type { Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk"

import type { Stage }                  from "./ase-test-case.js"
import type { Sandbox }                from "./ase-test-sandbox.js"
import { repoRoot }                    from "./ase-test-sandbox.js"
import type { Simulator, DialogEntry, Question } from "./ase-test-simulator.js"

/*  the recorder callbacks of a session run  */
export type SessionRecord = {
    onMessage: (msg: Record<string, any>) => void
    onStderr:  (data: string)             => void
}

/*  the outcome of one session run ("costUsd" is only a lower bound of the real
    spend when "costAccurate" is false, as a timed-out or crashed session may
    never deliver the final result message carrying the cost of its last turn;
    "turns" counts the result messages, i.e. the completed agentic turns, not
    the user turns of the "turns.maxTurns" case setting; "stopReason" and
    "apiStatus" are the subtype and HTTP status of an error result message, and
    "mcpFailed" flags a session whose ASE MCP server never connected)  */
export type SessionResult = {
    messages:     Record<string, any>[]
    output:       string[]
    lastText:     string
    dialog:       DialogEntry[]
    sessionId:    string
    model:        string
    costUsd:      number
    costAccurate: boolean
    turns:        number
    errored:      boolean
    crashed:      boolean
    timedOut:     boolean
    failure:      string
    stopReason:   string
    apiStatus:    number | null
    mcpFailed:    boolean
}

/*  render the invocation of the skill <skill> with the arguments <args>, adding the
    plugin namespace for an un-namespaced ASE skill (see "skillPrompt" of
    "tool/src/ase-agent-runtime-tool.ts")  */
export const skillPrompt = (skill: string, args: string): string => {
    const name = skill.startsWith("ase-") && !skill.includes(":") ? `ase:${skill}` : skill
    return `/${name}${args !== "" ? ` ${args}` : ""}`
}

/*  run one headless agent tool session in the sandbox: single-shot without a
    simulator, else a multi-turn conversation with streaming input, in which the
    simulator answers the intercepted "AskUserQuestion" calls and composes the
    free-text user turns until it ends the session or the turn cap is reached  */
export const runSession = async (stage: Stage, sandbox: Sandbox,
    simulator: Simulator | null, record: SessionRecord): Promise<SessionResult> => {
    const result: SessionResult = {
        messages: [], output: [], lastText: "", dialog: [], sessionId: "", model: "",
        costUsd: 0, costAccurate: true, turns: 0, errored: false, crashed: false, timedOut: false, failure: "",
        stopReason: "", apiStatus: null, mcpFailed: false
    }
    const prompt = stage.skill !== "" ? skillPrompt(stage.skill, stage.args) : stage.prompt

    /*  the streaming input queue: user messages are pushed as the conversation
        unfolds, and a null entry ends the input stream (and with it the session);
        the queue is fed only from the output loop below, whose "result" message
        marks the end of one agentic turn and is the only place to inject the next
        user turn (the single "notify" slot suffices for the single consumer)  */
    const pending: (SDKUserMessage | null)[] = []
    let notify: (() => void) | null = null
    const push = (msg: SDKUserMessage | null) => {
        pending.push(msg)
        notify?.()
        notify = null
    }
    async function * input (): AsyncGenerator<SDKUserMessage> {
        while (true) {
            while (pending.length === 0)
                await new Promise<void>((resolve) => { notify = resolve })
            const msg = pending.shift()!
            if (msg === null)
                return
            yield msg
        }
    }
    const userMessage = (text: string): SDKUserMessage => ({
        type: "user", message: { role: "user", content: text }, parent_tool_use_id: null
    })

    /*  the wall-clock timeout of the whole run (the "finished" flag keeps a timer
        firing in the same tick the session completed from marking a successful,
        fully paid run as timed out and provoking a pointless paid retry)  */
    let finished = false
    const abort  = new AbortController()
    const timer  = setTimeout(() => {
        if (finished)
            return
        result.timedOut = true
        abort.abort()
    }, stage.timeoutSec * 1000)

    /*  in plan mode, an "ExitPlanMode" call is auto-approved (the simulated user
        accepts every plan), and right after it the session is switched over to
        "acceptEdits" (outside the permission round-trip, on the next message),
        so the approved plan gets implemented in the same session  */
    let planApproved = false
    let planSwitched = false

    /*  the session options: the working-copy plugin, the sandboxed environment and
        settings, automatically classified permissions, and a hard budget and turn cap
        (the SDK "maxTurns" counts agentic turns: a generous 4 per allowed user turn,
        resp. 32 for a single-shot session, as a mere runaway backstop)  */
    const options: Options = {
        cwd:             sandbox.project,
        env:             sandbox.env,
        plugins:         [ { type: "local", path: path.join(repoRoot, "plugin") } ],
        settingSources:  [ "user" ],
        permissionMode:  stage.permissionMode,
        maxTurns:        simulator !== null ? stage.turns!.maxTurns * 4 : 32,
        maxBudgetUsd:    stage.maxUsd,
        abortController: abort,
        stderr:          record.onStderr,
        ...(process.env.ASE_TEST_MODEL !== undefined ? { model: process.env.ASE_TEST_MODEL } : {}),

        /*  the tools disallowed by the case (e.g. all writing tools of a review), and
            an "AskUserQuestion" call is answered by allowing it with the simulator's
            answers injected into its input (pre-supplied answers skip the interactive
            dialog), while every other permission request is blanket-allowed  */
        disallowedTools: [ ...stage.disallowedTools, ...(simulator === null ? [ "AskUserQuestion" ] : []) ],
        ...(simulator === null && stage.permissionMode !== "plan" ? {} : {
            canUseTool: async (toolName, toolInput) => {
                if (toolName === "ExitPlanMode")
                    planApproved = true
                if (toolName === "AskUserQuestion" && simulator !== null) {
                    const questions = (toolInput as { questions?: Question[] }).questions ?? []
                    const answers   = await simulator.answers(questions)
                    for (const question of questions)
                        result.dialog.push(
                            { role: "assistant", text: question.question },
                            { role: "user",      text: answers[question.question] ?? "" })
                    return { behavior: "allow", updatedInput: { ...toolInput, answers } }
                }
                return { behavior: "allow", updatedInput: toolInput }
            }
        })
    }

    /*  send a user turn, recording it, as the SDK does not echo the
        streaming-input user messages back into its message stream  */
    const sendUser = (text: string) => {
        push(userMessage(text))
        result.dialog.push({ role: "user", text })
        record.onMessage({ type: "user", synthetic: true, message: { role: "user", content: text } })
    }

    /*  drive the conversation  */
    sendUser(prompt)
    let userTurns = 1
    try {
        const session = query({ prompt: input(), options })
        for await (const msg of session) {
            if (planApproved && !planSwitched) {
                planSwitched = true
                await session.setPermissionMode("acceptEdits")
            }
            record.onMessage(msg as Record<string, any>)
            result.messages.push(msg as Record<string, any>)
            if (msg.type === "system" && msg.subtype === "init") {
                result.sessionId = msg.session_id
                result.model     = msg.model
            }
            else if (msg.type === "user") {
                /*  an unconnected ASE MCP server is reported to the model only through
                    the tool results (e.g. of "ToolSearch"), never as a session error  */
                const blocks = Array.isArray(msg.message?.content) ? msg.message.content : []
                for (const block of blocks as { type?: string, content?: unknown }[])
                    if (block.type === "tool_result") {
                        const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "")
                        if (/failed to connect/.test(text) && /plugin:ase:ase/.test(text))
                            result.mcpFailed = true
                    }
            }
            else if (msg.type === "assistant") {
                const blocks = Array.isArray(msg.message?.content) ? msg.message.content : []
                for (const block of blocks)
                    if (block.type === "text" && block.text.trim() !== "") {
                        result.output.push(...block.text.split("\n"))
                        result.lastText = block.text
                        result.dialog.push({ role: "assistant", text: block.text })
                    }
            }
            else if (msg.type === "result") {
                result.turns  += 1

                /*  the cost is cumulative, so the latest value replaces the previous one,
                    but a crash result may carry a zeroed cost which must never erase the
                    already accumulated spend  */
                result.costUsd = Math.max(result.costUsd, msg.total_cost_usd ?? 0)
                if (msg.is_error) {
                    /*  an API error carries the subtype "success", so prefer its terminal reason  */
                    const extra  = msg as { api_error_status?: number | null, terminal_reason?: string, result?: unknown }
                    const status = extra.api_error_status ?? null
                    const reason = msg.subtype === "success" ? (extra.terminal_reason ?? msg.subtype) : msg.subtype
                    const text   = String(extra.result ?? "").replace(/\s+/g, " ").slice(0, 300)
                    result.errored    = true
                    result.stopReason = reason
                    result.apiStatus  = status
                    result.failure    = `session error: ${reason}` +
                        (status !== null ? ` (HTTP ${status}): ${text}` : "")
                    push(null)
                }
                else if (simulator === null || userTurns >= stage.turns!.maxTurns)
                    push(null)
                else {
                    const turn = await simulator.nextTurn(result.dialog)
                    if (turn === null)
                        push(null)
                    else {
                        sendUser(turn)
                        userTurns += 1
                    }
                }
            }
        }
        finished = true
    }
    catch (err) {
        /*  the non-zero exit right after an error result message (e.g. a budget
            overrun or an API refusal) is only its consequence, not a crash, and
            its misleading stderr must never replace the reported real cause  */
        result.errored = true
        if (result.stopReason === "" || result.timedOut) {
            result.crashed      = !result.timedOut
            result.costAccurate = false
            result.failure      = result.timedOut ? `timeout after ${stage.timeoutSec}s` :
                `session crashed: ${err instanceof Error ? err.message : String(err)}`
        }
    }
    finally {
        clearTimeout(timer)
    }
    if (result.timedOut) {
        result.errored      = true
        result.costAccurate = false
        if (result.failure === "")
            result.failure = `timeout after ${stage.timeoutSec}s`
    }
    return result
}
