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
import { SimulatorError }            from "./ase-test-simulator.js"
import { pricingCost, pricingCallCost, pricingBudgetScale } from "./ase-test-pricing.js"
import type { CostBasis, ModelUsage } from "./ase-test-pricing.js"
import { GATEWAY_FAILURE }           from "./ase-test-report.js"

/*  the abort controllers of all live sessions, so an interrupt of the
    harness can abort them all and still tear down their sandboxes  */
export const liveAborts = new Set<AbortController>()
export const sessionInterrupt = { on: false }

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
    "apiStatus" are the subtype and HTTP status of an error result message,
    "mcpFailed" flags a session whose ASE MCP server never connected,
    "stalled" one aborted by the watchdog after a too long silence, "simFailed"
    one whose simulator failed, "budgetHit" one aborted by the table-priced
    budget watchdog, "apiFlaky" the first gateway or server error seen inside
    the session (e.g. a sub-agent hit by an HTTP 503), "apiRetries" and
    "lastApiRetryAt" the API retries of the agent tool itself (e.g. after an
    HTTP 504 of the gateway), "stallAt"/"abortAt" when the stall watchdog fired
    resp. the session was aborted, "sdkHung" a session whose SDK did not end
    after the abort, and "costBasis" tells how "costUsd" was priced)  */
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
    stalled:      boolean
    failure:      string
    stopReason:   string
    apiStatus:    number | null
    mcpFailed:    boolean
    simFailed:    boolean
    budgetHit:    boolean
    apiFlaky:     string
    apiRetries:   number
    apiRetryText: string
    lastApiRetryAt: number
    stallAt:      string
    abortAt:      string
    sdkHung:      boolean
    costBasis:    CostBasis
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
        costUsd: 0, costAccurate: true, turns: 0, errored: false, crashed: false, timedOut: false, stalled: false, failure: "",
        stopReason: "", apiStatus: null, mcpFailed: false, simFailed: false, budgetHit: false, apiFlaky: "",
        apiRetries: 0, apiRetryText: "", lastApiRetryAt: 0, stallAt: "", abortAt: "", sdkHung: false, costBasis: "sdk"
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
        fully paid run as timed out and provoking a pointless paid retry), whose
        deadline is pushed out by the time the simulator spends composing  */
    let finished = false
    const abort  = new AbortController()
    liveAborts.add(abort)
    let deadline = Date.now() + stage.timeoutSec * 1000
    let timer: ReturnType<typeof setTimeout> | null = null
    const deadlineArm = () => {
        if (timer !== null)
            clearTimeout(timer)
        timer = setTimeout(() => {
            if (finished || result.stalled)
                return
            result.timedOut = true
            abort.abort()
        }, Math.max(0, deadline - Date.now()))
    }
    deadlineArm()

    /*  the hard end after an abort (timeout, stall, budget, simulator, interrupt):
        an SDK which does not end its message stream within the grace period is
        left behind, so a wedged session can never outlast its own abort  */
    const SDK_GRACE_MS = 15 * 1000
    const FORCED       = Symbol("forced")
    let   graceTimer: ReturnType<typeof setTimeout> | null = null
    const forced = new Promise<typeof FORCED>((resolve) => {
        abort.signal.addEventListener("abort", () => {
            result.abortAt = new Date().toISOString()
            graceTimer = setTimeout(() => { resolve(FORCED) }, SDK_GRACE_MS)
        }, { once: true })
    })

    /*  the stall watchdog: abort a session without any SDK message (incl. the
        streamed partial messages) for "stallSec", e.g. a hanging gateway stream,
        where it is disarmed while the simulator composes an answer  */
    const stallSec = Number(process.env.ASE_TEST_STALL_SEC ?? "120")
    let stallTimer: ReturnType<typeof setTimeout> | null = null

    /*  the thinking progress since the last re-arm of the stall watchdog: a stream
        trickling a few thinking tokens (or only "ping" events) for minutes is as
        stuck as a silent one, so only a real progress re-arms the watchdog  */
    const stallMinTokens   = Number(process.env.ASE_TEST_STALL_MIN_TOKENS ?? "50")
    let   thinkingSinceArm = 0
    const stallDisarm = () => {
        if (stallTimer !== null)
            clearTimeout(stallTimer)
        stallTimer = null
    }
    const stallArm = () => {
        stallDisarm()
        thinkingSinceArm = 0
        if (!Number.isFinite(stallSec) || stallSec <= 0)
            return
        stallTimer = setTimeout(() => {
            if (finished || result.timedOut)
                return
            result.stalled = true
            result.stallAt = new Date().toISOString()
            abort.abort()
        }, stallSec * 1000)
    }

    /*  whether a session message proves progress: any regular message, any stream
        event except a keep-alive "ping" and a thinking delta, and thinking (deltas
        resp. "thinking_tokens" estimates) only once it adds up to "stallMinTokens"  */
    const progress = (msg: Record<string, any>): boolean => {
        let tokens: number
        if (msg.type === "stream_event") {
            const event = msg.event ?? {}
            if (event.type === "ping")
                return false
            if (event.type === "content_block_delta" && event.delta?.type === "thinking_delta")
                tokens = Math.ceil(String(event.delta.thinking ?? "").length / 4)
            else
                return true
        }
        else if (msg.type === "system" && msg.subtype === "api_retry")
            return false
        else if (msg.type === "system" && msg.subtype === "thinking_tokens")
            tokens = Number(msg.estimated_tokens_delta ?? 1)
        else
            return true
        thinkingSinceArm += tokens
        return thinkingSinceArm >= stallMinTokens
    }

    /*  run a simulator step with both the deadline and the stall watchdog paused,
        as the latency of the simulator is never the tested session's fault  */
    const simulate = async <T>(step: () => Promise<T>): Promise<T> => {
        const begin = Date.now()
        stallDisarm()
        if (timer !== null)
            clearTimeout(timer)
        try {
            return await step()
        }
        finally {
            deadline += Date.now() - begin
            if (!finished) {
                deadlineArm()
                stallArm()
            }
        }
    }

    /*  the live budget watchdog of a table-priced model, whose SDK budget cap is
        scaled up to a mere backstop: the per-call usages (keyed by message id, as
        the content blocks of one call arrive as several messages) are priced from
        the table, and the session is aborted once they exceed the stage budget  */
    const callCosts = new Map<string, number>()
    let liveUsd     = 0
    const budgetWatch = (msg: Record<string, any>) => {
        const usage = msg.message?.usage
        const cost  = usage !== undefined ? pricingCallCost(String(msg.message?.model ?? ""), usage) : null
        if (cost === null)
            return
        callCosts.set(String(msg.message?.id ?? callCosts.size), cost)
        liveUsd = [ ...callCosts.values() ].reduce((sum, c) => sum + c, 0)
        if (liveUsd > stage.maxUsd && !result.budgetHit) {
            result.budgetHit = true
            abort.abort()
        }
    }

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
        maxTurns:        stage.maxAgentTurns ?? (simulator !== null ? stage.turns!.maxTurns * 4 : 32),
        includePartialMessages: true,
        maxBudgetUsd:    stage.maxUsd * pricingBudgetScale(process.env.ASE_TEST_MODEL ?? ""),
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
                    let answers: Record<string, string>
                    try {
                        answers = await simulate(() => simulator.answers(questions))
                    }
                    catch (err) {
                        /*  a failed simulator aborts the session as an infrastructure error  */
                        result.simFailed = true
                        result.failure   = err instanceof Error ? err.message : String(err)
                        abort.abort()
                        return { behavior: "deny", message: "simulated user unavailable" }
                    }
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

    /*  the stream heartbeat: the streamed partial messages are not recorded one
        by one, so once a minute their event types, the streamed characters, and
        the tail of the streamed text are recorded, which tells a model streaming
        one huge block from a stuck gateway stream afterwards  */
    let streamCounts: Record<string, number> = {}
    let streamChars = 0
    let streamTail  = ""
    const streamNote = (event: Record<string, any>) => {
        const type  = String(event.type ?? "?")
        const delta = event.delta ?? {}
        const text  = String(delta.text ?? delta.thinking ?? delta.partial_json ?? "")
        const key   = type === "content_block_delta" ? `${type}/${String(delta.type ?? "?")}` : type
        streamCounts[key] = (streamCounts[key] ?? 0) + 1
        streamChars += text.length
        streamTail   = (streamTail + text).slice(-200)
    }
    const heartbeat = setInterval(() => {
        if (Object.keys(streamCounts).length === 0)
            return
        record.onMessage({ type: "harness", subtype: "stream_heartbeat", counts: streamCounts, chars: streamChars, tail: streamTail })
        streamCounts = {}
        streamChars  = 0
    }, 60 * 1000)

    /*  drive the conversation  */
    sendUser(prompt)
    let userTurns = 1
    try {
        const session  = query({ prompt: input(), options })
        const iterator = session[Symbol.asyncIterator]()
        stallArm()
        while (true) {
            const step = await Promise.race([ iterator.next(), forced ])
            if (step === FORCED) {
                result.sdkHung = true
                iterator.return?.(undefined)?.catch(() => { /*  ignore  */ })
                throw new Error(`SDK did not end within ${SDK_GRACE_MS / 1000}s after the abort`)
            }
            if (step.done === true)
                break
            const msg = step.value
            if (progress(msg as Record<string, any>))
                stallArm()

            /*  the streamed partial messages only prove the session alive  */
            if (msg.type === "stream_event") {
                streamNote((msg as { event?: Record<string, any> }).event ?? {})
                continue
            }
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
            else if (msg.type === "system" && (msg as { subtype?: string }).subtype === "api_retry") {
                /*  an API retry of the agent tool itself (e.g. after an HTTP 504 of the gateway)  */
                const retry = msg as { error_status?: number | null, error?: string }
                result.apiRetries    += 1
                result.lastApiRetryAt = Date.now()
                result.apiRetryText   = `API Error: ${retry.error_status ?? retry.error ?? "unknown"} (agent tool retry)`
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
                        const flaky = GATEWAY_FAILURE.exec(text)
                        if (flaky !== null && result.apiFlaky === "")
                            result.apiFlaky = flaky[0]
                    }
            }
            else if (msg.type === "assistant") {
                budgetWatch(msg as Record<string, any>)
                const blocks = Array.isArray(msg.message?.content) ? msg.message.content : []
                for (const block of blocks)
                    if (block.type === "text" && block.text.trim() !== "") {
                        const flaky = GATEWAY_FAILURE.exec(block.text)
                        if (flaky !== null && result.apiFlaky === "")
                            result.apiFlaky = flaky[0]
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
                const usage = (msg as { modelUsage?: Record<string, ModelUsage> }).modelUsage
                const cost  = usage !== undefined ? pricingCost(usage) : { usd: msg.total_cost_usd ?? 0, basis: "sdk" as const }
                result.costUsd   = Math.max(result.costUsd, cost.usd)
                result.costBasis = cost.basis
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
                    const turn = await simulate(() => simulator.nextTurn(result.dialog))
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
        if (sessionInterrupt.on) {
            result.costAccurate = false
            result.failure      = "interrupted"
        }
        else if (err instanceof SimulatorError || result.simFailed) {
            result.simFailed    = true
            result.costAccurate = false
            if (result.failure === "" || err instanceof SimulatorError)
                result.failure = err instanceof SimulatorError ? err.message : result.failure
        }
        else if (result.budgetHit) {
            result.stopReason = "error_max_budget_usd"
            result.failure    = `session error: error_max_budget_usd (table-priced $${liveUsd.toFixed(2)} ` +
                `exceeds $${stage.maxUsd.toFixed(2)})`
        }
        else if (result.stopReason === "" || result.timedOut || result.stalled) {
            result.crashed      = !result.timedOut && !result.stalled
            result.costAccurate = false
            result.failure      = result.stalled ? `stall: no progress for ${stallSec}s` :
                result.timedOut ? `timeout after ${stage.timeoutSec}s` :
                    `session crashed: ${err instanceof Error ? err.message : String(err)}`
        }
        if (result.sdkHung && !/SDK did not end/.test(result.failure))
            result.failure += ` (SDK did not end within ${SDK_GRACE_MS / 1000}s after the abort)`
    }
    finally {
        finished = true
        clearInterval(heartbeat)
        if (graceTimer !== null)
            clearTimeout(graceTimer)
        if (timer !== null)
            clearTimeout(timer)
        stallDisarm()
        liveAborts.delete(abort)
    }

    /*  the priced per-call usages bound the cost of a session cut short
        before its final result message from below  */
    if (liveUsd > result.costUsd) {
        result.costUsd   = liveUsd
        result.costBasis = "table"
    }
    if (result.stalled) {
        result.errored      = true
        result.costAccurate = false
        if (result.failure === "")
            result.failure = `stall: no progress for ${stallSec}s`
    }
    else if (result.timedOut) {
        result.errored      = true
        result.costAccurate = false
        if (result.failure === "")
            result.failure = `timeout after ${stage.timeoutSec}s`
    }
    return result
}
