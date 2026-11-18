/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as path from "node:path"

import chalk     from "chalk"
import prettyMs  from "pretty-ms"

import type { OracleResult } from "./ase-test-oracle.js"

/*  the kind of an infrastructure error ("" for none): a gateway outage or server
    error, an API refusal or a sub-agent API error, an unconnected MCP server, a
    failed simulator, a stalled session, a failed evaluation, or a plain crash  */
export type InfraKind = "gateway" | "api" | "mcp" | "sim" | "stall" | "eval" | "crash" | ""

/*  the failure texts of a gateway outage resp. a transient server error  */
export const GATEWAY_FAILURE =
    /Couldn't load settings from Cloud gateway|API Error: (?:5\d\d|529)\b|Service Temporarily Unavailable|overloaded_error/

/*  the outcome of one run of a case  */
export type RunOutcome = {
    run:        number
    outcome:    "pass" | "fail" | "error" | "skipped"
    costUsd:    number
    bookedUsd:  number
    costBasis:  string
    durationMs: number
    failure:    string
    infraKind:  InfraKind
    artifacts:  string
    model:      string
    oracles:    OracleResult[]
}

/*  the aggregated outcome of one case, where an "incomplete" case missed
    "minPass" only for lack of evaluated runs (skipped or errored ones)  */
export type CaseOutcome = {
    name:       string
    skill:      string
    runs:       RunOutcome[]
    minPass:    number
    pass:       boolean
    incomplete: boolean
}

/*  aggregate the runs of one case (pass@k), where the missing runs of a
    not passed case could still have reached "minPass" resp. could not  */
export const caseAggregate = (name: string, skill: string, runs: RunOutcome[], minPass: number): CaseOutcome => {
    const passed  = runs.filter((run) => run.outcome === "pass").length
    const missing = runs.filter((run) => run.outcome === "skipped" || run.outcome === "error").length
    const pass    = passed >= minPass
    return { name, skill, runs, minPass, pass, incomplete: !pass && passed + missing >= minPass }
}

/*  the end of one stage of a staged run, for its live console progress  */
export type StageEnd = {
    durationMs: number
    costUsd:    number
    errored:    boolean
    timedOut:   boolean
    failure:    string
    oracles:    OracleResult[]
}

/*  print the live console progress of one stage of a staged run: its start
    (without "end"), resp. its end with duration, cost, and failed diagnostics  */
export const reportStage = (label: string, stage: number, total: number, skill: string, end?: StageEnd): void => {
    const what = `${label}: stage ${stage}/${total} ${skill}`
    if (end === undefined) {
        console.log(`${chalk.dim("▸")} ${what} ${chalk.dim("started")}`)
        return
    }
    const bad  = end.errored || end.timedOut
    const info = `(${prettyMs(end.durationMs)}, $${end.costUsd.toFixed(4)})`
    console.log(`${bad ? chalk.red("▪") : chalk.green("▪")} ${what} ` +
        `${bad ? chalk.red(end.timedOut ? "timed out" : `errored: ${end.failure}`) : "finished"} ${chalk.dim(info)}`)
    for (const oracle of end.oracles)
        if (!oracle.pass)
            console.log(`    ${chalk.yellow(`◦ ${oracle.kind}`)}: ${oracle.detail}`)
}

/*  print the console report of one finished run, with the optional failure
    hint of the case shown below any failed run (e.g. operator guidance)  */
export const reportRun = (name: string, outcome: RunOutcome, failHint = ""): void => {
    const mark = outcome.outcome === "pass" ? chalk.green("✔") :
        outcome.outcome === "fail"    ? chalk.red("✘") :
            outcome.outcome === "skipped" ? chalk.yellow("−") : chalk.red("⚠")
    const booked = Math.abs(outcome.bookedUsd - outcome.costUsd) >= 0.00005 ?
        ` (booked $${outcome.bookedUsd.toFixed(4)})` : ""
    const basis  = outcome.costBasis !== "" && outcome.costBasis !== "sdk" ? ` ${outcome.costBasis}` : ""
    const info = `(${prettyMs(outcome.durationMs)}, $${outcome.costUsd.toFixed(4)}${booked}${basis}` +
        `${outcome.model !== "" ? `, ${outcome.model}` : ""})`
    console.log(`${mark} ${name} run ${outcome.run} ${chalk.dim(info)}`)
    for (const oracle of outcome.oracles)
        if (!oracle.pass)
            console.log(`    ${oracle.diagnostic === true ?
                chalk.yellow(`◦ ${oracle.kind}`) : chalk.red(`✘ ${oracle.kind}`)}: ${oracle.detail}`)
    if (outcome.outcome === "fail" && outcome.failure !== ""
        && !outcome.oracles.some((oracle) => !oracle.pass && oracle.diagnostic !== true))
        console.log(`    ${chalk.red("✘ evaluation")}: ${outcome.failure}`)
    if (outcome.outcome === "error")
        console.log(`    ${chalk.red(`⚠ infra${outcome.infraKind !== "" ? ` (${outcome.infraKind})` : ""}`)}: ${outcome.failure}`)
    if (outcome.outcome !== "pass" && outcome.outcome !== "skipped" && failHint !== "")
        console.log(`    ${chalk.cyan("↪ hint")}: ${failHint}`)
    if (outcome.outcome !== "pass" && outcome.artifacts !== "")
        console.log(`    ${chalk.dim(`artifacts: ${outcome.artifacts}`)}`)
}

/*  write the "summary.json" (also incrementally during the run, so even a killed
    harness leaves a partial summary behind)  */
export const summaryWrite = (resultsDir: string, cases: CaseOutcome[],
    totalUsd: number, sideUsd: number, aborted: string, meta: Record<string, string>): void => {
    fs.mkdirSync(resultsDir, { recursive: true })
    const file = path.join(resultsDir, "summary.json")
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({
        meta,
        cases: cases.map((caze) => ({
            name:       caze.name,
            skill:      caze.skill,
            pass:       caze.pass,
            incomplete: caze.incomplete,
            minPass:    caze.minPass,
            runs:       caze.runs.map((run) => ({
                run:        run.run,
                outcome:    run.outcome,
                costUsd:    run.costUsd,
                bookedUsd:  run.bookedUsd,
                costBasis:  run.costBasis,
                durationMs: run.durationMs,
                failure:    run.failure,
                infraKind:  run.infraKind,
                artifacts:  run.artifacts,
                model:      run.model,
                oracles:    run.oracles
            }))
        })),
        totalUsd,
        sideUsd,
        aborted
    }, null, 4), "utf8")
    fs.renameSync(`${file}.tmp`, file)
}

/*  print the console summary and write the final "summary.json", resolving to the exit code  */
export const reportSummary = (resultsDir: string, cases: CaseOutcome[],
    totalUsd: number, sideUsd: number, aborted: string, meta: Record<string, string>): number => {
    console.log("")
    if ((meta.model ?? "") !== "")
        console.log(chalk.dim(`model: ${meta.model}`))
    for (const caze of cases) {
        const passed = caze.runs.filter((run) => run.outcome === "pass").length
        const mark   = caze.pass ? chalk.green("PASS") : caze.incomplete ? chalk.yellow("INCOMPLETE") : chalk.red("FAIL")
        console.log(`${mark} ${caze.name} ` +
            chalk.dim(`(${passed}/${caze.runs.length} runs passed, ${caze.minPass} required)`))
    }
    const passed     = cases.filter((caze) => caze.pass).length
    const incomplete = cases.filter((caze) => caze.incomplete).length
    const failed     = cases.length - passed - incomplete
    const errored    = cases.some((caze) => caze.runs.some((run) => run.outcome === "error" || run.outcome === "skipped"))
    const unpriced   = cases.reduce((sum, caze) => sum + caze.runs.filter((run) => run.costBasis === "unpriced").length, 0)
    console.log("")
    console.log(`${passed}/${cases.length} cases passed, ${failed} failed, ${incomplete} incomplete, ` +
        `total cost: $${totalUsd.toFixed(2)} (incl. $${sideUsd.toFixed(2)} simulator/judge)` +
        (unpriced > 0 ? chalk.yellow(` (${unpriced} run(s) unpriced: costs are fallback estimates)`) : "") +
        `${aborted !== "" ? chalk.red(` (aborted: ${aborted})`) : ""}`)
    summaryWrite(resultsDir, cases, totalUsd, sideUsd, aborted, meta)
    console.log(chalk.dim(`summary: ${path.join(resultsDir, "summary.json")}`))

    /*  the exit code precedence: a hit cost ceiling or an interrupt (2) beats a failed
        case (1), which beats an incomplete case, an infrastructure error, or a skipped run (2)  */
    return aborted !== "" ? 2 : (failed > 0 ? 1 : (errored || incomplete > 0 ? 2 : 0))
}
