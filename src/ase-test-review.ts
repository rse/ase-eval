/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as path from "node:path"
import * as url  from "node:url"

import type { OracleResult } from "./ase-test-oracle.js"

/*  the typed facade over the library of the "ase-repo-review" benchmark
    (see "src/review/lib/"), the only module of the harness touching it,
    loaded dynamically as plain JavaScript modules without type declarations  */
const libDir = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "review", "lib")
const lib    = async <T>(name: string): Promise<T> =>
    await import(url.pathToFileURL(path.join(libDir, name)).href) as T

/*  the parts of the evaluated run and of the threshold verdict used here  */
type Stats       = { mean: number | null }
type Recall      = { obvious: number, medium: number, hidden: number, overall: number, adequate?: number }
type Evaluated   = {
    status:           string
    verdict:          string | null
    recall?:          Recall
    hits?:            string[]
    hits_adequate?:   string[]
    decoys_reported?: string[]
    false_alarm_rate?: number | null
    unassignable?:    number
    accepted?:        number
    duplicates?:      number
    findings_reported?: number
}
type Criterion   = { value: number | null, limit: number, kind: "min" | "max", met: boolean }
type Aggregated  = {
    recall:           Record<string, Stats>
    false_alarm_rate: Stats
    threshold:        { verdict: string, criteria: Record<string, Criterion> }
}

/*  the library functions used here  */
const { listFiles }          = await lib<{ listFiles: (dir: string) => string[] }>("common.mjs")
const { findLeak }           = await lib<{ findLeak: (text: string) => string | null }>("leak.mjs")
const { checkContamination } = await lib<{ checkContamination: (events: unknown[]) => string[] }>("runner.mjs")
const { evaluateRun, aggregate } = await lib<{
    evaluateRun: (run: Record<string, unknown>, expected: unknown) => Evaluated
    aggregate:   (runs: Evaluated[], thresholds: unknown) => Aggregated
}>("scoring.mjs")

/*  the hinting terms (see "findLeak" of "src/review/lib/leak.mjs") in the
    names and lines of all files below the directories <dirs> (empty ones are
    skipped) and in the commit message <message>, as a list of problems  */
export const reviewLeaks = (dirs: string[], message: string): string[] => {
    const problems: string[] = []
    for (const dir of dirs.filter((dir) => dir !== "")) {
        for (const file of listFiles(dir)) {
            const inName = findLeak(file)
            if (inName !== null)
                problems.push(`file name ${file} contains "${inName}"`)
            fs.readFileSync(path.join(dir, file), "utf8").split(/\r?\n/).forEach((line, i) => {
                const hit = findLeak(line)
                if (hit !== null)
                    problems.push(`${path.basename(dir)}/${file}:${i + 1} contains "${hit}"`)
            })
        }
    }
    const hit = findLeak(message)
    if (hit !== null)
        problems.push(`commit message contains "${hit}"`)
    return problems
}

/*  format a ratio for the oracle detail  */
const ratio = (value: number | null | undefined): string =>
    value === null || value === undefined ? "n/a" : value.toFixed(2)

/*  score the review text <text> against the expected-results list <expectedFile>
    and judge it against the thresholds <thresholdsFile> as a single run, after
    checking the tool calls of the raw session messages <messages> for any access
    to the benchmark itself or to the ASE repository outside "plugin/" and "tool/"  */
export const reviewScore = (text: string, expectedFile: string, thresholdsFile: string,
    messages: unknown[]): OracleResult => {
    const contamination = checkContamination(messages)
    if (contamination.length > 0)
        return { kind: "review", pass: false, log: text, detail: `contamination: ${contamination.join("; ")}` }
    const expected   = JSON.parse(fs.readFileSync(expectedFile,   "utf8")) as unknown
    const thresholds = JSON.parse(fs.readFileSync(thresholdsFile, "utf8")) as unknown
    const run        = evaluateRun({ name: "run", status: "ok", review: text }, expected)

    /*  an unrecognizable output never counts silently as "no findings"  */
    if (run.status !== "ok" || run.recall === undefined)
        return {
            kind: "review", pass: false, log: text, metrics: { ...run },
            detail: "review output unparseable (no verdict or findings table)"
        }
    const agg    = aggregate([ run ], thresholds)
    const failed = Object.entries(agg.threshold.criteria).filter(([ , c ]) => !c.met)
        .map(([ name, c ]) => `${name} ${ratio(c.value)} ${c.kind === "min" ? "<" : ">"} ${c.limit}`)
    return {
        kind:    "review",
        pass:    agg.threshold.verdict === "threshold met",
        log:     text,
        metrics: { ...run, threshold: agg.threshold },
        detail:  `recall ${ratio(run.recall.overall)} (obvious ${ratio(run.recall.obvious)}, ` +
            `medium ${ratio(run.recall.medium)}, hidden ${ratio(run.recall.hidden)})` +
            (run.recall.adequate !== undefined ? `, adequate ${ratio(run.recall.adequate)}` : "") +
            `, decoys ${ratio(run.false_alarm_rate)}, unassignable ${run.unassignable ?? 0}` +
            `, verdict ${run.verdict ?? "?"}` +
            (failed.length > 0 ? `; not met: ${failed.join(", ")}` : "")
    }
}
