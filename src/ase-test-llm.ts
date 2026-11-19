/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import Anthropic from "@anthropic-ai/sdk"
import chalk     from "chalk"
import { query } from "@anthropic-ai/claude-agent-sdk"

import type { Sandbox }   from "./ase-test-sandbox.js"
import { pricingCallCost, pricingCost } from "./ase-test-pricing.js"
import { outageWait, pause }            from "./ase-test-outage.js"
import type { ModelUsage } from "./ase-test-pricing.js"

/*  the hard timeout of a single completion, so a hung endpoint or a wedged agent
    tool subprocess can never freeze a worker of the run pool forever  */
const LLM_TIMEOUT_MS = 120 * 1000

/*  the accumulated spend of all simulator and judge completions, booked
    against the global cost ceiling (the plain SDK path reports no cost, so
    only a model of the pricing table contributes there)  */
export const llmSpend = { usd: 0, fallbacks: 0 }

/*  a single-shot, tool-less LLM text completion for the user simulator and the
    rubric judge: with an API key the plain Anthropic SDK is used directly (cheap,
    no subprocess per judge vote), else the completion runs through the Agent SDK,
    whose process authenticates with the same (OAuth) credentials of the sandboxed
    HOME as the tested sessions -- both paths are needed, as the plain SDK cannot
    authenticate with OAuth credentials at all  */
const llmTextOnce = async (sandbox: Sandbox, model: string,
    system: string, prompt: string): Promise<string> => {
    const abort = new AbortController()
    const timer = setTimeout(() => { abort.abort() }, LLM_TIMEOUT_MS)
    try {
        if (process.env.ANTHROPIC_API_KEY !== undefined) {
            const client   = new Anthropic()
            const response = await client.messages.create({
                model, max_tokens: 1024, system,
                messages: [ { role: "user", content: prompt } ]
            }, { signal: abort.signal })
            if (response.stop_reason === "refusal")
                throw new Error(`safeguards flagged this message (refusal, model: ${model})`)
            llmSpend.usd += pricingCallCost(model, response.usage as Record<string, any>) ?? 0
            return response.content.filter((block) => block.type === "text")
                .map((block) => block.text).join("\n").trim()
        }
        let text = ""
        for await (const msg of query({
            prompt,
            options: {
                cwd:             sandbox.home,
                env:             sandbox.env,
                settingSources:  [],
                systemPrompt:    { type: "custom", prompt: system },
                tools:           [],
                maxTurns:        1,
                abortController: abort,
                model
            }
        })) {
            if (msg.type === "assistant")
                for (const block of (Array.isArray(msg.message?.content) ? msg.message.content : []))
                    if (block.type === "text")
                        text += block.text
            if (msg.type === "result") {
                const usage = (msg as { modelUsage?: Record<string, ModelUsage> }).modelUsage
                llmSpend.usd += usage !== undefined ? pricingCost(usage).usd : (msg.total_cost_usd ?? 0)
            }
        }
        return text.trim()
    }
    catch (err) {
        if (abort.signal.aborted)
            throw new Error(`LLM completion timeout after ${LLM_TIMEOUT_MS / 1000}s (model: ${model})`, { cause: err })
        throw err
    }
    finally {
        clearTimeout(timer)
    }
}

/*  whether a completion failure is transient (a timeout, a rate limit, a server
    error, or a network error), i.e. worth a retry after a pause  */
const TRANSIENT_FAILURE = /completion timeout|\b(?:429|5\d\d)\b|overloaded|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|fetch failed|Connection error/i

/*  a completion retried on transient failures: up to two retries, each after the
    end of a gateway outage pause and 30 s plus a jitter, where a still failing
    completion is reported as a gateway error (so it pauses all workers, too)  */
const llmTextRetried = async (sandbox: Sandbox, model: string,
    system: string, prompt: string): Promise<string> => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await llmTextOnce(sandbox, model, system, prompt)
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            if (!TRANSIENT_FAILURE.test(message))
                throw err
            if (attempt >= 3)
                throw new Error(`gateway: ${message}`, { cause: err })
            console.log(chalk.yellow(`⚠ judge/simulator: ${message} -- retrying (attempt ${attempt + 1}/3)`))
            await outageWait()
            await pause(30 * 1000 + Math.random() * 15 * 1000)
        }
    }
}

/*  the completion of the simulator and the judge, where a safeguard refusal of the
    reference model (deterministic for the prompt, and frequent for the transcripts
    of weaker models) is repeated once with the fallback reference model  */
export const llmText = async (sandbox: Sandbox, model: string,
    system: string, prompt: string): Promise<string> => {
    try {
        return await llmTextRetried(sandbox, model, system, prompt)
    }
    catch (err) {
        const fallback = process.env.ASE_TEST_REF_FALLBACK ?? ""
        if (!/safeguards flagged/.test(err instanceof Error ? err.message : String(err))
            || fallback === "" || fallback === model)
            throw err
        llmSpend.fallbacks += 1
        console.log(chalk.yellow(`⚠ judge/simulator: safeguards refused "${model}" -- falling back to "${fallback}"`))
        return llmTextRetried(sandbox, fallback, system, prompt)
    }
}
