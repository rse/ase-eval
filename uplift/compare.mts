/*
**  compare.mts -- compare the arms of the ASE uplift benchmark: reads the
**  "summary.json" of the baseline arms (uplift/) and of the ASE arm
**  (cases/flow/csvq-grill) of one "run_uplift_test.sh" invocation and prints
**  one table over pass, hidden suite tests, exec oracles, cost, and duration
**
**  Usage: node --import tsx uplift/compare.mts results/uplift-<timestamp>
*/

import * as fs   from "node:fs"
import * as path from "node:path"

type Oracle  = { kind: string, pass: boolean, detail?: string }
type Run     = { run: number, outcome: string, costUsd: number, durationMs: number, oracles: Oracle[] }
type Case    = { name: string, pass: boolean, runs: Run[] }
type Summary = { cases: Case[] }

const base = process.argv[2]
if (base === undefined) {
    console.error("usage: compare.mts <results-base-directory>")
    process.exit(2)
}

/*  load one summary.json (a missing one yields no rows instead of a crash)  */
const load = (dir: string): Case[] => {
    const file = path.join(base, dir, "summary.json")
    if (!fs.existsSync(file)) {
        console.error(`compare: missing "${file}" -- skipping its arms`)
        return []
    }
    return (JSON.parse(fs.readFileSync(file, "utf8")) as Summary).cases
}

/*  the hidden suite tests passed/total of one run, parsed from the "suite"
    oracle detail ("12/12 tests passed" resp. "ran 12, failures 2, ...")  */
const suiteScore = (run: Run): string => {
    const detail = run.oracles.find((oracle) => oracle.kind === "suite")?.detail ?? ""
    let m = /^(\d+)\/(\d+) tests passed/.exec(detail)
    if (m !== null)
        return `${m[1]}/${m[2]}`
    m = /^ran (\d+), failures (\d+), errors (\d+), skipped (\d+)/.exec(detail)
    if (m !== null && Number(m[1]) > 0)
        return `${Number(m[1]) - Number(m[2]) - Number(m[3]) - Number(m[4])}/${m[1]}`
    return "0/?"
}

/*  render the per-run rows of the arms plus the closing uplift line  */
const rows: string[][] = [ [ "arm", "run", "outcome", "suite tests", "exec oracles", "cost", "duration" ] ]
const best: { arm: string, score: number, of: string }[] = []
for (const caze of [ ...load("baseline"), ...load("ase") ]) {
    const arm = caze.name.split("/").at(-1)!
    let top = -1
    let of  = "?"
    for (const run of caze.runs) {
        const execs = run.oracles.filter((oracle) => oracle.kind === "exec")
        const suite = suiteScore(run)
        const [ passed, total ] = suite.split("/")
        if (Number(passed) > top) {
            top = Number(passed)
            of  = total
        }
        rows.push([ arm, String(run.run), run.outcome, suite,
            `${execs.filter((oracle) => oracle.pass).length}/${execs.length}`,
            `$${run.costUsd.toFixed(2)}`, `${(run.durationMs / 60000).toFixed(1)}m` ])
    }
    best.push({ arm, score: top, of })
}
if (rows.length === 1) {
    console.error("compare: no runs found")
    process.exit(2)
}
const width = rows[0].map((_, i) => Math.max(...rows.map((row) => row[i].length)))
const line  = (row: string[]) => "| " + row.map((cell, i) => cell.padEnd(width[i])).join(" | ") + " |"
console.log("")
console.log(line(rows[0]))
console.log("|" + width.map((w) => "-".repeat(w + 2)).join("|") + "|")
for (const row of rows.slice(1))
    console.log(line(row))
console.log("")
console.log("uplift (hidden suite tests of the best run): " +
    best.map((b) => `${b.arm} ${b.score < 0 ? "-" : b.score}/${b.of}`).join(", "))
