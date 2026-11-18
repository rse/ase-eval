#!/usr/bin/env node
/*
**  ASE review benchmark -- one measurement in one command: runs of several models,
**  comparison, and log entry with a template for the manual reading
**  Usage: node measure.mjs --help
*/

import fs            from "node:fs"
import path          from "node:path"
import { spawnSync } from "node:child_process"

import { REVIEW_DIR, DOCS_DIR, DEFAULT_CASE, resolveCase, readJson } from "./lib/common.mjs"
import { loadExpected }                                   from "./lib/expected.mjs"
import { collectRunDirs, buildReport, thresholdVersion, promptVersion } from "./lib/report.mjs"
import { renderSection, scorerVersion }                   from "./lib/journal.mjs"
import { stamp, conditionSpec, toolBuilt, CONDITION_NAMES, DEFAULT_CONDITION } from "./lib/runner.mjs"

const JOURNAL = path.join(DOCS_DIR, "MEASUREMENTS.md")
const HELP = `Usage: node measure.mjs [options]

  --case <name>        test case (default: ${DEFAULT_CASE})
  --conditions <list>  comma-separated measurement conditions (default: ${DEFAULT_CONDITION};
                       known: ${CONDITION_NAMES.join(", ")})
  --models <list>      comma-separated models for claude -p (default: opus,sonnet)
  --runs <n>           runs per condition and model (default: 3)
  --confirm-paid       explicit flag for paid runs
  --dry-run            whole pipeline without a model call; writes a preview of the
                       log entry into the series folder instead of MEASUREMENTS.md
  --title <text>       heading of the log entry (default: start date, case, conditions, and models)
  --keep-reference     copy the runs into the reference folder of the case
  --help               this help

All runs of one call go into one series folder under the results folder of the
case; only these runs are compared and logged. Paid runs need the threshold file,
the expected-results list, the scoring code, and the prompt file of a condition
committed; runs with ASE need a built tool/ as well. A series the budget cuts short
is neither compared nor logged: the call names the missing runs and ends with exit
code 3, and the completed runs stay in the series folder.
`

/*  parse the command line  */
export function options (argv) {
    const o = { caseName: DEFAULT_CASE, conditions: [ DEFAULT_CONDITION ], models: [ "opus", "sonnet" ], runs: 3,
        confirmPaid: false, dryRun: false, title: null, keepReference: false, help: false }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        const v = () => {
            if (i + 1 >= argv.length)
                throw new Error(`${a} needs a value`)
            return argv[++i]
        }
        if      (a === "--case")           o.caseName      = v()
        else if (a === "--conditions")     o.conditions    = v().split(",").map((m) => m.trim()).filter(Boolean)
        else if (a === "--models")         o.models        = v().split(",").map((m) => m.trim()).filter(Boolean)
        else if (a === "--runs")           o.runs          = Math.max(1, Math.floor(Number(v()) || 0))
        else if (a === "--confirm-paid")   o.confirmPaid   = true
        else if (a === "--dry-run")        o.dryRun        = true
        else if (a === "--title")          o.title         = v()
        else if (a === "--keep-reference") o.keepReference = true
        else if (a === "--help")           o.help          = true
        else
            throw new Error(`unknown option: ${a}`)
    }
    if (o.models.length === 0)
        throw new Error("--models needs at least one model")
    if (o.conditions.length === 0)
        throw new Error("--conditions needs at least one condition")
    if (o.dryRun && o.keepReference)
        throw new Error("--keep-reference only for paid runs")
    o.case = resolveCase(o.caseName)
    /*  reject an unknown condition, and one named twice, before any run starts: its runs
        would land in one group and count double  */
    for (const [ i, name ] of o.conditions.entries()) {
        conditionSpec(name)
        if (o.conditions.indexOf(name) !== i)
            throw new Error(`--conditions names "${name}" twice`)
    }
    return o
}

/*  preconditions checked before any money is spent; the version probe of a prompt file and
    the check for the built tool can be replaced, so the self-test does not depend on what
    is committed or built  */
export function preflight (o, probe = promptVersion, built = toolBuilt) {
    if (o.dryRun)
        return []
    const problems = []
    if (!o.confirmPaid)
        problems.push("paid runs without --confirm-paid: obtain the cost approval first, then start with --confirm-paid")
    const tv = thresholdVersion(o.case)
    if (tv.commit === null || tv.modified)
        problems.push("the threshold file of the case is not committed or modified: commit it first")
    /*  what a single condition needs is checked before the first run of the series, not only
        before the first run of that condition, which the runs of another may precede  */
    const specs = o.conditions.map((name) => conditionSpec(name))
    for (const spec of specs) {
        if (spec.promptFile === null)
            continue
        const pv = probe(spec.promptFile)
        if (pv.commit === null || pv.modified)
            problems.push(`the prompt file of the condition ${spec.name} (${pv.file}) is not committed or modified: `
                + `commit it first, otherwise the ${spec.name} runs of the series would be refused`)
    }
    if (specs.some((spec) => spec.usesAse) && !built())
        problems.push("tool/ is not built: cd tool && npm start build")
    const sv = scorerVersion(o.case)
    if (sv.commit === null || sv.modified)
        problems.push("the scoring code or the expected-results list has uncommitted changes: commit them first, "
            + "otherwise the log entry would be refused after the paid runs")
    return problems
}

/*  cost spent so far in a series folder; a run without cost report counts with its full limit  */
function spentIn (dir, dryRun) {
    return collectRunDirs([ dir ]).reduce((sum, d) => {
        const m = readJson(path.join(d, "run.json"))
        return sum + (m.cost_usd ?? (dryRun ? 0 : m.budget_usd ?? 5))
    }, 0)
}

/*  planned runs a series does not have: per condition and model, the planned number against
    the result folders found  */
export function seriesGaps (o, dirs) {
    const metas = dirs.map((d) => readJson(path.join(d, "run.json")))
    const gaps  = []
    for (const condition of o.conditions)
        for (const model of o.models) {
            const done = metas.filter((m) => (m.condition ?? DEFAULT_CONDITION) === condition && m.model?.requested === model).length
            if (done < o.runs)
                gaps.push({ condition, model, planned: o.runs, done, missing: o.runs - done })
        }
    return gaps
}

/*  run a benchmark script with the same Node.js and show its output  */
function node (script, args) {
    return spawnSync(process.execPath, [ path.join(REVIEW_DIR, script), ...args ], { stdio: "inherit" }).status
}

/*  main; the run starter and the error output can be replaced, so the self-test can
    provoke a budget stop without a paid run  */
export function main (argv = process.argv.slice(2), start = node, errOut = (text) => process.stderr.write(text)) {
    let o
    try {
        o = options(argv)
    }
    catch (err) {
        errOut(`${err.message}\n\n${HELP}`)
        return 2
    }
    if (o.help) {
        process.stdout.write(HELP)
        return 0
    }
    const problems = preflight(o)
    if (problems.length > 0) {
        errOut("preconditions not met, no model call:\n" + problems.map((p) => `  - ${p}\n`).join(""))
        return 1
    }
    const c      = o.case
    const series = path.join(c.resultsDir, `series-${stamp()}${o.dryRun ? "-dry" : ""}`)
    fs.mkdirSync(series, { recursive: true })

    /*  runs, one condition and model after the other, within one shared series budget  */
    let budgetReached = false
    for (const condition of o.conditions) {
        for (const model of o.models) {
            process.stdout.write(`== ${c.name}, ${condition}, ${model}, ${o.runs} run(s)\n`)
            const status = start("run.mjs", [ "--case", c.name, "--condition", condition, "--model", model,
                "--runs", String(o.runs), "--out", series,
                "--prior-spent", spentIn(series, o.dryRun).toFixed(2), ...(o.dryRun ? [ "--dry-run" ] : [ "--confirm-paid" ]) ])
            if (status === 3) {
                errOut("series budget reached; the remaining runs are skipped\n")
                budgetReached = true
                break
            }
            if (status !== 0) {
                errOut(`run.mjs ended with exit code ${status}; measurement stopped\n`)
                return 1
            }
        }
        if (budgetReached)
            break
    }
    const dirs = collectRunDirs([ series ])

    /*  a series the budget cut short compares groups of unequal size, or one condition with
        nothing at all; it is not compared and not logged, since a log entry cannot be taken back  */
    const gaps = budgetReached ? seriesGaps(o, dirs) : []
    if (gaps.length > 0) {
        errOut("the series is incomplete, so it is neither compared nor logged:\n"
            + gaps.map((g) => `  - ${g.condition}, ${g.model}: ${g.missing} of ${g.planned} run(s) missing\n`).join("")
            + `the ${dirs.length} completed run(s) stay in ${series}\n`)
        return 3
    }
    if (dirs.length === 0) {
        errOut(`no completed runs in ${series}\n`)
        return 1
    }

    /*  comparison and log entry; a dry run only previews the entry  */
    const report = path.join(series, "report")
    if (o.dryRun) {
        if (start("compare.mjs", [ "--case", c.name, "--out", report, series ]) !== 0)
            return 1
        const expected = loadExpected(c.expectedFile)
        const entry    = renderSection({ title: o.title ?? `${c.name} (dry run)`, dirs, report: buildReport(dirs, expected, c), expected, c })
        const preview  = path.join(series, "log-preview.md")
        fs.writeFileSync(preview, entry.section)
        process.stdout.write(`dry run: log entry previewed in ${preview}, MEASUREMENTS.md unchanged\n`)
        return 0
    }
    if (start("compare.mjs", [ "--case", c.name, "--out", report, "--journal", JOURNAL, ...(o.title ? [ "--title", o.title ] : []), series ]) !== 0)
        return 1

    /*  optional reference copy of the runs  */
    if (o.keepReference) {
        for (const d of dirs) {
            const target = path.join(c.referenceDir, "runs", path.basename(d))
            fs.cpSync(d, target, { recursive: true, errorOnExist: true, force: false })
        }
        process.stdout.write(`${dirs.length} runs copied to ${path.join(c.referenceDir, "runs")}\n`)
    }
    process.stdout.write("next: complete the manual reading in MEASUREMENTS.md, then commit the log"
        + (o.keepReference ? " and the reference runs" : "") + "\n")
    return 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(REVIEW_DIR, "measure.mjs"))
    process.exitCode = main()
