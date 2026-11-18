/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as path from "node:path"

import YAML      from "yaml"
import { z }     from "zod"

import { harnessRoot } from "./ase-test-sandbox.js"

/*  the token prices of one model (USD per million tokens)  */
const rateSchema = z.strictObject({
    inUsdPerM:         z.number().nonnegative(),
    outUsdPerM:        z.number().nonnegative(),
    cacheReadUsdPerM:  z.number().nonnegative().optional(),
    cacheWriteUsdPerM: z.number().nonnegative().optional()
})
export type Rate = z.infer<typeof rateSchema>
const pricingSchema = z.strictObject({
    fallback: rateSchema,
    models:   z.record(z.string(), rateSchema).optional()
})

/*  the basis of a reported cost: the agent tool's own pricing, the
    recomputation from the pricing table, or the unknown-model fallback  */
export type CostBasis = "sdk" | "table" | "unpriced"

/*  the token usage of one model, as in the "modelUsage" of a result message  */
export type ModelUsage = {
    inputTokens?:              number
    outputTokens?:             number
    cacheReadInputTokens?:     number
    cacheCreationInputTokens?: number
    costUSD?:                  number
    costBasis?:                string
}

/*  load the pricing table once (a missing table leaves every model unpriced)  */
const pricingFile = path.join(harnessRoot, "etc", "pricing.yaml")
const pricing = ((): z.infer<typeof pricingSchema> => {
    if (!fs.existsSync(pricingFile))
        return { fallback: { inUsdPerM: 4, outUsdPerM: 20, cacheReadUsdPerM: 0.2 }, models: {} }
    const parsed = pricingSchema.safeParse(YAML.parse(fs.readFileSync(pricingFile, "utf8")))
    if (!parsed.success)
        throw new Error(`invalid pricing table "${pricingFile}": ${z.prettifyError(parsed.error)}`)
    return parsed.data
})()

/*  the table rate of a model, or null when it has no entry  */
export const pricingRate = (model: string): Rate | null =>
    pricing.models?.[model] ?? null

/*  the cost of a token usage at a rate (cache prices default to 10% resp. 125% of the input price)  */
const usageCost = (rate: Rate, usage: { input: number, output: number, cacheRead: number, cacheWrite: number }): number =>
    (usage.input      * rate.inUsdPerM +
     usage.output     * rate.outUsdPerM +
     usage.cacheRead  * (rate.cacheReadUsdPerM  ?? rate.inUsdPerM * 0.10) +
     usage.cacheWrite * (rate.cacheWriteUsdPerM ?? rate.inUsdPerM * 1.25)) / 1e6

/*  the cost of the cumulative "modelUsage" of a result message: the SDK cost of
    a priced model as-is, else the recomputation from the pricing table, else
    the (fallback-priced) SDK cost flagged as "unpriced"  */
export const pricingCost = (modelUsage: Record<string, ModelUsage>): { usd: number, basis: CostBasis } => {
    let usd   = 0
    let basis: CostBasis = "sdk"
    for (const [ model, usage ] of Object.entries(modelUsage)) {
        const rate = pricingRate(model)
        if (usage.costBasis !== "unknown")
            usd += usage.costUSD ?? 0
        else if (rate !== null) {
            usd += usageCost(rate, {
                input:      usage.inputTokens              ?? 0,
                output:     usage.outputTokens             ?? 0,
                cacheRead:  usage.cacheReadInputTokens     ?? 0,
                cacheWrite: usage.cacheCreationInputTokens ?? 0
            })
            if (basis === "sdk")
                basis = "table"
        }
        else {
            usd  += usage.costUSD ?? 0
            basis = "unpriced"
        }
    }
    return { usd, basis }
}

/*  the cost of the usage of one API call ("usage" of an assistant message) of a
    model with a table rate, or null for a model without one  */
export const pricingCallCost = (model: string, usage: Record<string, any>): number | null => {
    const rate = pricingRate(model)
    if (rate === null)
        return null
    return usageCost(rate, {
        input:      usage.input_tokens                ?? 0,
        output:     usage.output_tokens               ?? 0,
        cacheRead:  usage.cache_read_input_tokens     ?? 0,
        cacheWrite: usage.cache_creation_input_tokens ?? 0
    })
}

/*  the factor by which the SDK budget cap of a table-priced model has to be scaled,
    as the agent tool books its usage at the (much higher) fallback prices  */
export const pricingBudgetScale = (model: string): number => {
    const rate = pricingRate(model)
    if (rate === null)
        return 1
    const ratio = (fallback: number, real: number) => real > 0 ? fallback / real : 1
    return Math.max(1,
        ratio(pricing.fallback.inUsdPerM,  rate.inUsdPerM),
        ratio(pricing.fallback.outUsdPerM, rate.outUsdPerM))
}
