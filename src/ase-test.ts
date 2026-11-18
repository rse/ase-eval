/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as path from "node:path"

import { Command } from "commander"
import picomatch   from "picomatch"
import chalk       from "chalk"
import { execa }   from "execa"

import { caseDiscover }                    from "./ase-test-case.js"
import type { TestCase }                   from "./ase-test-case.js"
import { sandboxCreate, sandboxTeardown, harnessRoot, repoRoot } from "./ase-test-sandbox.js"
import type { Sandbox }                    from "./ase-test-sandbox.js"
import { runSession }                      from "./ase-test-session.js"
import type { SessionResult }              from "./ase-test-session.js"
import { simulatorCreate }                 from "./ase-test-simulator.js"
import { transcriptOpen, transcriptFinish } from "./ase-test-transcript.js"
import type { StageOutcome }               from "./ase-test-transcript.js"
import { oraclesRun, changesetDiff, skillSpoke } from "./ase-test-oracle.js"
import type { OracleResult }               from "./ase-test-oracle.js"
import { describeCase }                    from "./ase-test-describe.js"
import { reportRun, reportStage, reportSummary } from "./ase-test-report.js"
import type { RunOutcome, CaseOutcome }    from "./ase-test-report.js"

/*  the CLI of the skill test harness  */
const program = new Command()
program
    .name("ase-test")
    .description("ASE Skill Test Harness")
    .argument("[globs...]", "case name globs to run (default: all cases)")
    .option("-c, --cases <glob...>", "case name globs to run (for \"npm start test\", " +
        "whose positional words stx consumes as task names)")
    .option("-C, --cases-dir <dir>", "cases directory, relative to the harness root " +
        "(e.g. \"uplift\" for the uplift benchmark)", "cases")
    .option("-j, --jobs <n>", "number of parallel runs (default: $ASE_TEST_JOBS, else 4)")
    .option("-l, --list", "list the discovered cases and exit", false)
    .option("-d, --describe", "describe the matched cases (input, fixture, simulator, oracles) and exit", false)
    .option("-k, --keep", "keep the sandboxes of all runs", false)
    .option("-K, --keep-failed", "keep the sandboxes of failed runs", false)
    .option("-m, --max-cost-usd <n>", "global cost ceiling in USD", "20")
    .option("-b, --budget-factor <n>", "factor applied to the per-run budgets of all cases " +
        "(default: $ASE_TEST_BUDGET_FACTOR, else 1)")
    .option("--allow-stale", "run even if the tool build is older than its sources", false)
    .option("-r, --results <dir>", "results directory (default: results/<timestamp>)")
    .option("--llm <file>", "env-file profile for an Anthropic-compatible " +
        "gateway (default: $ASE_TEST_LLM)")
    .parse(process.argv)
const opts  = program.opts()
const globs = [ ...program.args, ...(opts.cases ?? []) ]

/*  optionally load an LLM gateway profile: an env file routing the harness and its
    sandboxed sessions to an Anthropic-compatible endpoint (e.g. a LiteLLM proxy in
    front of a local model) -- already exported variables take precedence  */
const llmProfile = opts.llm ?? process.env.ASE_TEST_LLM
if (llmProfile !== undefined && llmProfile !== "") {
    const file = path.resolve(llmProfile)
    if (!fs.existsSync(file)) {
        console.error(chalk.red(`LLM gateway profile not found: ${file}`))
        process.exit(2)
    }
    process.loadEnvFile(file)
}

/*  discover and filter the cases  */
const casesDir = path.join(harnessRoot, opts.casesDir)
let cases = caseDiscover(casesDir)
if (globs.length > 0) {
    const matchers = globs.map((glob) => picomatch(glob))
    cases = cases.filter((caze) => matchers.some((matches) => matches(caze.name)))
}
if (opts.list) {
    for (const caze of cases)
        console.log(`${caze.name} ` + chalk.dim(`(runs: ${caze.runs}, minPass: ${caze.minPass}, ` +
            `${caze.staged ? `staged/${caze.stages.length}` :
                (caze.turns !== null ? `interactive/${caze.turns.simulator}` : "single-shot")})`))
    process.exit(0)
}
if (cases.length === 0) {
    console.error(chalk.red("no test cases matched"))
    process.exit(1)
}
if (opts.describe) {
    console.log(cases.map((caze) => describeCase(caze)).join("\n\n"))
    process.exit(0)
}

/*  preflight: the fully built tool (the "ase" CLI of the plugin MCP server) and credentials,
    where the Vite-built web board client is the artifact of the last build stage (the
    service crash-loops on its absence, so "dst/ase.js" alone proves too little)  */
for (const file of [ "dst/ase.js", "dst/ase-task-board-web-client.html" ])
    if (!fs.existsSync(path.join(repoRoot, "tool", file))) {
        console.error(chalk.red(`tool is not fully built ("tool/${file}" missing) -- run: cd ../tool && npm start build`))
        process.exit(2)
    }

/*  preflight: the tool build must not be older than its sources, as the plugin is
    loaded from the working copy while its MCP server runs the built "dst/" code  */
const newestMtime = (dir: string): number =>
    fs.readdirSync(dir, { withFileTypes: true }).reduce((max, entry) => Math.max(max,
        entry.isDirectory() ? newestMtime(path.join(dir, entry.name)) :
            fs.statSync(path.join(dir, entry.name)).mtimeMs), 0)
const toolBuilt = fs.statSync(path.join(repoRoot, "tool", "dst", "ase.js")).mtime
if (newestMtime(path.join(repoRoot, "tool", "src")) > toolBuilt.getTime() && !(opts.allowStale as boolean)) {
    console.error(chalk.red("tool build is stale (tool/src newer than tool/dst) -- " +
        "run: cd ../tool && npm start build (or pass --allow-stale)"))
    process.exit(2)
}
if (process.env.ANTHROPIC_API_KEY === undefined
    && process.env.CLAUDE_CODE_OAUTH_TOKEN === undefined
    && !fs.existsSync(path.join(process.env.HOME ?? "", ".claude", ".credentials.json"))) {
    console.error(chalk.red("no agent tool credentials found: set ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN"))
    process.exit(2)
}
if (cases.some((caze) => caze.oracles.some((oracle) => "suite" in oracle))
    && (await execa("python3", [ "--version" ], { reject: false })).failed) {
    console.error(chalk.red("no \"python3\" found in $PATH, but required by the \"suite\" oracle"))
    process.exit(2)
}

/*  the results directory of this harness invocation  */
const timestamp  = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const resultsDir = opts.results !== undefined ?
    path.resolve(opts.results) : path.join(harnessRoot, "results", timestamp)

/*  the global budget state and the parallelism, where the jobs default is resolved
    only here, after the LLM gateway profile could set "ASE_TEST_JOBS" (non-numeric
    values must never silently disable the ceiling or starve the worker pool)  */
const maxCostUsd = Number(opts.maxCostUsd)
const jobsValue  = opts.jobs ?? process.env.ASE_TEST_JOBS ?? "4"
const jobs       = Number(jobsValue)
if (!Number.isFinite(maxCostUsd) || maxCostUsd <= 0) {
    console.error(chalk.red(`invalid --max-cost-usd value: "${opts.maxCostUsd}"`))
    process.exit(2)
}
if (!Number.isInteger(jobs) || jobs < 1) {
    console.error(chalk.red(`invalid --jobs resp. $ASE_TEST_JOBS value: "${jobsValue}"`))
    process.exit(2)
}

/*  scale the per-run budgets, e.g. for gateway models without prompt caching,
    whose every turn re-sends the full context at the full input price  */
const budgetValue  = opts.budgetFactor ?? process.env.ASE_TEST_BUDGET_FACTOR ?? "1"
const budgetFactor = Number(budgetValue)
if (!Number.isFinite(budgetFactor) || budgetFactor <= 0) {
    console.error(chalk.red(`invalid --budget-factor resp. $ASE_TEST_BUDGET_FACTOR value: "${budgetValue}"`))
    process.exit(2)
}
for (const caze of cases) {
    caze.maxUsd *= budgetFactor
    for (const stage of caze.stages)
        stage.maxUsd *= budgetFactor
}

/*  the global ceiling scales with the per-run budgets, so the scaled budgets
    of a few slow or failed runs cannot alone exhaust an unscaled ceiling  */
const ceilingUsd = maxCostUsd * budgetFactor

/*  the money actually booked against the ceiling, and the reason why scheduling
    stopped ("" while it did not, so the string doubles as the stop flag)  */
let totalUsd = 0
let aborted  = ""

/*  the booking of a session cost against the ceiling: an accurate cost as-is, a
    session which never produced an assistant message (e.g. a crash while loading
    the gateway settings) at its (zero) lower bound, and any other inaccurate cost
    (timeout, stall, or crash mid-session) at the mean accurate cost so far, which
    is capped by the budget and falls back to it as long as no mean exists  */
let accurateUsd   = 0
let accurateCount = 0
const bookCost = (result: SessionResult, maxUsd: number): number => {
    if (result.costAccurate) {
        accurateUsd   += result.costUsd
        accurateCount += 1
        return result.costUsd
    }
    if (!result.messages.some((msg) => msg.type === "assistant"))
        return result.costUsd
    const estimate = accurateCount > 0 ? accurateUsd / accurateCount : maxUsd
    return Math.min(maxUsd, Math.max(result.costUsd, estimate))
}

/*  the consecutive infrastructure errors (e.g. during a gateway outage), which
    make the workers back off before scheduling further runs  */
let infraStreak = 0

/*  execute one attempt of one run of a case, containing every failure (a throw
    escaping here would reject the whole worker pool and lose all results)  */
const executeAttempt = async (caze: TestCase, run: number, retried: boolean):
Promise<{ outcome: RunOutcome, retry: boolean }> => {
    const started = Date.now()
    const outcome: RunOutcome = {
        run, outcome: "fail", costUsd: 0, durationMs: 0,
        failure: "", artifacts: "", model: "", oracles: []
    }
    let retry   = false
    let sandbox: Sandbox | null = null
    let keep    = opts.keep as boolean
    try {
        const transcript  = transcriptOpen(resultsDir, caze, run, retried)
        outcome.artifacts = transcript.dir
        sandbox           = await sandboxCreate(caze, run)

        /*  run the stages one after the other in the shared sandbox (a single-skill
            case is the degenerate one-stage case), where the arguments of a stage
            receive the last messages of the earlier stages, the diagnostic oracles of
            a stage are evaluated right after it, and an errored stage of a staged case
            skips all remaining stages  */
        const results:     SessionResult[] = []
        const stages:      StageOutcome[]  = []
        const diagnostics: OracleResult[]  = []
        const label = `${caze.name} run ${run}${retried ? " (retry)" : ""}`
        for (const [ index, stage ] of caze.stages.entries()) {
            const args      = !caze.staged ? stage.args :
                stage.args.replace(/\{\{stage(\d+)\.lastMessage\}\}/g, (_m, n: string) => results[Number(n) - 1].lastText)
            const simulator = simulatorCreate(stage, sandbox)
            const begin     = Date.now()
            if (caze.staged)
                reportStage(label, index + 1, caze.stages.length, stage.skill)
            const result    = await runSession({ ...stage, args }, sandbox, simulator, transcript.record(index + 1))
            results.push(result)

            /*  an inaccurate cost (timeout, stall, or crash before the final result
                message) is only a lower bound, so book a plausible estimate globally  */
            totalUsd += bookCost(result, stage.maxUsd)
            if (!caze.staged)
                continue

            /*  an evaluation failure of a diagnostic oracle is diagnostic itself  */
            let oracles: OracleResult[]
            try {
                const diff = stage.oracles.length > 0 ? await changesetDiff(sandbox) : ""
                oracles = await oraclesRun(stage.oracles, caze, sandbox, result, diff)
            }
            catch (err) {
                oracles = [ { kind: "evaluation", pass: false, detail: err instanceof Error ? err.message : String(err) } ]
            }
            oracles = oracles.map((oracle) => ({ ...oracle, kind: `stage${index + 1}/${oracle.kind}`, diagnostic: true }))
            diagnostics.push(...oracles)
            reportStage(label, index + 1, caze.stages.length, stage.skill, {
                durationMs: Date.now() - begin, costUsd: result.costUsd, errored: result.errored,
                timedOut: result.timedOut, failure: result.failure, oracles
            })
            stages.push({
                stage: index + 1, skill: stage.skill, sessionId: result.sessionId, model: result.model,
                costUsd: result.costUsd, turns: result.turns, errored: result.errored,
                timedOut: result.timedOut, failure: result.failure, oracles
            })
            if (result.errored)
                break
        }

        /*  the overall session result: the one of a single-skill case, resp. the
            merged results of the stages of a staged case, of which only the last
            one can have errored  */
        const last   = results[results.length - 1]
        const where  = `stage ${results.length} (${caze.stages[results.length - 1].skill})`
        const result: SessionResult = !caze.staged ? last : {
            messages:     results.flatMap((r) => r.messages),
            output:       results.flatMap((r) => r.output),
            lastText:     last.lastText,
            dialog:       results.flatMap((r) => r.dialog),
            sessionId:    last.sessionId,
            model:        [ ...new Set(results.map((r) => r.model)) ].join(", "),
            costUsd:      results.reduce((sum, r) => sum + r.costUsd, 0),
            costAccurate: results.every((r) => r.costAccurate),
            turns:        results.reduce((sum, r) => sum + r.turns, 0),
            errored:      last.errored,
            crashed:      last.crashed,
            timedOut:     last.timedOut,
            failure:      last.failure !== "" ? `${where}: ${last.failure}` : "",
            stopReason:   last.stopReason,
            apiStatus:    last.apiStatus,
            mcpFailed:    results.some((r) => r.mcpFailed),
            stalled:      last.stalled
        }
        outcome.costUsd = result.costUsd
        outcome.model   = result.model

        /*  an infrastructure failure is a crash without any skill output -- a
            timeout is never one, as retrying the most expensive failure mode
            would double the spend of a merely too slow case  */
        const infra = (last.crashed && !last.timedOut && !skillSpoke(last.output)) || result.mcpFailed || last.stalled
        const api   = last.apiStatus !== null
        if (infra || api) {
            /*  an API refusal (e.g. HTTP 403 for an inaccessible model) is an
                infrastructure error, too, but only a rate limit or a server
                error is transient enough to be worth a paid retry  */
            outcome.outcome = "error"
            outcome.failure = result.mcpFailed && result.failure === "" ?
                "MCP server plugin:ase:ase failed to connect" : result.failure
            outcome.oracles = diagnostics
            retry = !retried && (!api || last.apiStatus === 429 || last.apiStatus! >= 500)
            await transcriptFinish(transcript, caze, sandbox, result, "", diagnostics, false, stages)
        }
        else if (caze.staged && last.errored) {
            /*  an errored stage of a staged case fails the run without evaluating
                the top-level oracles, as the remaining stages were skipped  */
            outcome.outcome = "fail"
            outcome.failure = `${where} errored: ${last.failure}`
            outcome.oracles = diagnostics
            await transcriptFinish(transcript, caze, sandbox, result, "", diagnostics, false, stages)
        }
        else {
            /*  an evaluation failure after the (expensive) session is a plain
                case failure and never triggers the infrastructure retry  */
            try {
                const diff      = await changesetDiff(sandbox)
                outcome.oracles = [ ...diagnostics, ...await oraclesRun(caze.oracles, caze, sandbox, result, diff) ]

                /*  a skill re-invoking itself through the "Skill" tool (instead of
                    following its already loaded workflow) is diagnostic only  */
                if (!caze.staged && caze.skill !== "") {
                    const names  = [ caze.skill, `ase:${caze.skill}` ]
                    const reruns = result.messages
                        .filter((msg) => msg.type === "assistant")
                        .flatMap((msg) => ((msg.message?.content ?? []) as { type: string, name?: string, input?: { skill?: string } }[]))
                        .filter((block) => block.type === "tool_use" && block.name === "Skill"
                            && names.includes(block.input?.skill ?? "")).length
                    if (reruns > 0)
                        outcome.oracles.push({
                            kind: "selfInvoke", pass: false, diagnostic: true,
                            detail: `skill re-invoked itself ${reruns} time(s)`
                        })
                }
                for (const [ index, r ] of results.entries())
                    if (r.costUsd > caze.stages[index].maxUsd)
                        outcome.oracles.push({
                            kind: "budget", pass: false,
                            detail: `${caze.staged ? `stage ${index + 1}` : "run"} cost $${r.costUsd.toFixed(2)} ` +
                                `exceeds budget $${caze.stages[index].maxUsd.toFixed(2)}`
                        })
                outcome.outcome = outcome.oracles.every((oracle) => oracle.pass || oracle.diagnostic === true) ?
                    "pass" : "fail"
                outcome.failure = result.failure
                await transcriptFinish(transcript, caze, sandbox, result, diff,
                    outcome.oracles, outcome.outcome === "pass", stages)
            }
            catch (err) {
                outcome.outcome = "fail"
                outcome.failure = `evaluation failed: ${err instanceof Error ? err.message : String(err)}`
            }
        }
    }
    catch (err) {
        outcome.outcome = "error"
        outcome.failure = err instanceof Error ? err.message : String(err)
        retry = !retried
    }
    finally {
        outcome.durationMs = Date.now() - started
        keep = keep || (outcome.outcome !== "pass" && (opts.keepFailed as boolean))
        if (sandbox !== null) {
            try {
                await sandboxTeardown(sandbox, keep)
                if (keep && outcome.artifacts !== "")
                    await fs.promises.writeFile(path.join(outcome.artifacts, "sandbox.txt"),
                        `${sandbox.root}\n`, "utf8")
            }
            catch (err) {
                console.log(chalk.yellow(`⚠ ${caze.name} run ${run}: sandbox teardown failed: ` +
                    `${err instanceof Error ? err.message : String(err)}`))
            }
        }
    }
    return { outcome, retry }
}

/*  execute one run of a case, where an infrastructure error gets one retry in its
    own artifact directory, started only after the first attempt is fully torn down
    and only while the global ceiling still allows it  */
const executeRun = async (caze: TestCase, run: number): Promise<RunOutcome> => {
    const first = await executeAttempt(caze, run, false)
    if (!first.retry || aborted !== "" || totalUsd > ceilingUsd)
        return first.outcome
    console.log(chalk.yellow(`⚠ ${caze.name} run ${run}: ${first.outcome.failure} -- retrying once`))
    const second = await executeAttempt(caze, run, true)

    /*  carry the first attempt's spend into the reported outcome (the per-run costs
        report the measured spend, a lower bound after a timeout or crash, while the
        global total books such runs pessimistically at their full budget, so both
        sums agree only when every cost was accurate)  */
    second.outcome.costUsd += first.outcome.costUsd
    return second.outcome
}

/*  the run pool: all runs of all cases, executed with bounded concurrency,
    where the global cost ceiling stops the scheduling of further runs  */
const work: { caze: TestCase, run: number, outcome: RunOutcome | null }[] = []
for (const caze of cases)
    for (let run = 1; run <= caze.runs; run++)
        work.push({ caze, run, outcome: null })
let next = 0
const worker = async (): Promise<void> => {
    while (next < work.length) {
        const item = work[next++]
        if (aborted !== "") {
            item.outcome = {
                run: item.run, outcome: "skipped", costUsd: 0, durationMs: 0,
                failure: `skipped (${aborted})`, artifacts: "", model: "", oracles: []
            }
            continue
        }
        if (infraStreak >= 3) {
            const pauseSec = Math.min(60 * 2 ** (infraStreak - 3), 300)
            console.log(chalk.yellow(`⏸ ${infraStreak} consecutive infrastructure errors -- pausing ${pauseSec}s`))
            await new Promise<void>((resolve) => setTimeout(resolve, pauseSec * 1000))
        }
        item.outcome = await executeRun(item.caze, item.run)
        reportRun(item.caze.name, item.outcome, item.caze.failHint)
        infraStreak = item.outcome.outcome === "error" ? infraStreak + 1 : 0
        if (totalUsd > ceilingUsd && aborted === "")
            aborted = `cost ceiling $${ceilingUsd.toFixed(2)} exceeded`
    }
}
console.log(`running ${work.length} run(s) of ${cases.length} case(s) ` +
    chalk.dim(`(jobs: ${jobs}, budget: $${ceilingUsd.toFixed(2)}` +
        (process.env.ANTHROPIC_BASE_URL !== undefined ? `, endpoint: ${process.env.ANTHROPIC_BASE_URL}` : "") +
        `, results: ${resultsDir})`))
await Promise.all(Array.from({ length: Math.min(jobs, work.length) }, () => worker()))

/*  aggregate the outcomes per case (pass@k) and report, with the run provenance
    (models, endpoint, versions) as the comparison key of future summaries  */
const outcomes: CaseOutcome[] = cases.map((caze) => {
    const runs   = work.filter((item) => item.caze === caze).map((item) => item.outcome!)
    const passed = runs.filter((run) => run.outcome === "pass").length
    return { name: caze.name, skill: caze.skill, runs, minPass: caze.minPass, pass: passed >= caze.minPass }
})
const pluginCommit = await execa("git", [ "rev-parse", "HEAD" ], { cwd: repoRoot, reject: false })
    .then(({ stdout }) => (stdout ?? "").trim())
const sdkVersion = await fs.promises.readFile(
    path.join(harnessRoot, "node_modules", "@anthropic-ai", "claude-agent-sdk", "package.json"), "utf8")
    .then((text) => (JSON.parse(text) as { version?: string }).version ?? "").catch(() => "")
const pluginVersion = await fs.promises.readFile(
    path.join(repoRoot, "plugin", "package.json"), "utf8")
    .then((text) => (JSON.parse(text) as { version?: string }).version ?? "").catch(() => "")
const meta = {
    timestamp,
    endpoint:     process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    model:        process.env.ASE_TEST_MODEL ?? "(account default)",
    judgeModel:   process.env.ASE_TEST_JUDGE_MODEL ?? "claude-haiku-5-5",
    simModel:     process.env.ASE_TEST_SIM_MODEL ?? "claude-haiku-5-5",
    pluginCommit,
    pluginVersion,
    toolBuilt:    toolBuilt.toISOString(),
    budgetFactor: String(budgetFactor),
    sdkVersion,
    nodeVersion:  process.version
}
process.exit(reportSummary(resultsDir, outcomes, totalUsd, aborted, meta))
