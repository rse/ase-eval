/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as path from "node:path"

/*  the shape of a "summary.json" file (tolerantly read, all fields optional)  */
export type HistoryRun     = {
    run: number, outcome: string, costUsd: number, durationMs: number, model: string,
    infraKind?: string, costBasis?: string
}
export type HistoryCase    = {
    name: string, skill: string, pass: boolean, incomplete?: boolean, minPass: number, runs: HistoryRun[]
}
export type HistoryMeta    = { timestamp?: string, model?: string, pluginCommit?: string, pluginVersion?: string }
export type HistorySummary = { meta: HistoryMeta, cases: HistoryCase[], totalUsd: number, aborted: string }

/*  collect the summary files below a results directory: its direct children and,
    with a depth above 1, further nesting levels (the uplift layout)  */
export const summaryScan = (dir: string, depth: number): string[] => {
    const files: string[] = []
    if (!fs.existsSync(dir))
        return files
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue
        const sub  = path.join(dir, entry.name)
        const file = path.join(sub, "summary.json")
        if (fs.existsSync(file))
            files.push(file)
        else if (depth > 1)
            files.push(...summaryScan(sub, depth - 1))
    }
    return files
}

/*  the model label of a summary: the forced model, else the most frequent
    per-run model (the first one of a comma-separated per-run model list)  */
export const summaryModel = (summary: HistorySummary): string => {
    const model = summary.meta?.model ?? ""
    if (model !== "" && model !== "(account default)")
        return model
    const freq = new Map<string, number>()
    for (const caze of summary.cases)
        for (const run of caze.runs ?? []) {
            const first = (run.model ?? "").split(",")[0].trim()
            if (first !== "")
                freq.set(first, (freq.get(first) ?? 0) + 1)
        }
    return [ ...freq.entries() ].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "(account default)"
}

/*  the cases a model passed in every executed run of its last <depth> executions
    of the case, where skipped runs and infrastructure errors say nothing about the
    model, so an execution needs at least one other run, and a case with fewer than
    <depth> executions is never stable (summaries: file path and parsed content)  */
export const stableCases = (summaries: { file: string, summary: HistorySummary }[],
    model: string, caseNames: string[], depth = 2): Set<string> => {
    const time = (entry: { file: string, summary: HistorySummary }) =>
        entry.summary.meta?.timestamp ?? path.basename(path.dirname(entry.file))
    const own = summaries
        .filter((entry) => Array.isArray(entry.summary.cases) && summaryModel(entry.summary) === model)
        .sort((a, b) => time(b).localeCompare(time(a)))
    const stable = new Set<string>()
    for (const name of caseNames) {
        const executions: HistoryRun[][] = []
        for (const entry of own) {
            const caze = entry.summary.cases.find((c) => c.name === name)
            const runs = (caze?.runs ?? []).filter((run) => run.outcome !== "skipped" && run.outcome !== "error")
            if (runs.length > 0)
                executions.push(runs)
            if (executions.length === depth)
                break
        }
        if (executions.length === depth && executions.every((runs) => runs.every((run) => run.outcome === "pass")))
            stable.add(name)
    }
    return stable
}

/*  load all readable summaries below a results directory (unreadable ones are left out)  */
export const summaryLoadAll = (dir: string, depth = 2): { file: string, summary: HistorySummary }[] => {
    const result: { file: string, summary: HistorySummary }[] = []
    for (const file of summaryScan(dir, depth)) {
        try {
            const summary = JSON.parse(fs.readFileSync(file, "utf8")) as HistorySummary
            if (typeof summary === "object" && summary !== null && Array.isArray(summary.cases))
                result.push({ file, summary })
        }
        catch (_err) {
            /*  an unreadable summary carries no evidence  */
        }
    }
    return result
}
