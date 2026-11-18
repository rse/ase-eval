/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs    from "node:fs"
import * as path  from "node:path"

import { Command } from "commander"
import chalk       from "chalk"
import prettyMs    from "pretty-ms"

import { harnessRoot } from "./ase-test-sandbox.js"

/*  the shape of a "summary.json" file (tolerantly read, all fields optional)  */
type Run     = { run: number, outcome: string, costUsd: number, durationMs: number, model: string }
type Case    = { name: string, skill: string, pass: boolean, minPass: number, runs: Run[] }
type Meta    = { timestamp?: string, model?: string, pluginCommit?: string, pluginVersion?: string }
type Summary = { meta: Meta, cases: Case[], totalUsd: number, aborted: string }

/*  one collected run summary, annotated with its origin and labels  */
type Entry = {
    dir:     string
    summary: Summary
    model:   string
    version: string
    time:    string
}

/*  the aggregate of all runs of one matrix cell resp. time-table row  */
type Agg = { total: number, passed: number, costUsd: number, durationMs: number, infra: number }

/*  parse the command line  */
const program = new Command()
program
    .name("ase-test-compare")
    .description("compare the summaries of multiple ASE skill test harness runs")
    .option("-r, --results <dir>", "results directory to scan for summaries", "results")
    .option("-a, --add <dir...>", "additional run directories (each holding a summary.json)", [])
    .option("-o, --out <dir>", "directory to write COMPARISON.md and COMPARISON.html into", ".")
    .parse(process.argv)
const opts = program.opts<{ results: string, add: string[], out: string }>()

/*  collect the summary files: direct children of the results directory, one
    nesting level deeper (the uplift layout), and the explicitly added dirs  */
const summaryFiles: string[] = []
const scanDir = (dir: string, depth: number): void => {
    if (!fs.existsSync(dir))
        return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue
        const sub  = path.join(dir, entry.name)
        const file = path.join(sub, "summary.json")
        if (fs.existsSync(file))
            summaryFiles.push(file)
        else if (depth > 1)
            scanDir(sub, depth - 1)
    }
}
const resultsDir = path.isAbsolute(opts.results) ? opts.results : path.join(harnessRoot, opts.results)
scanDir(resultsDir, 2)
for (const dir of opts.add) {
    const file = path.join(dir, "summary.json")
    if (fs.existsSync(file))
        summaryFiles.push(file)
    else
        console.error(chalk.yellow(`WARNING: no summary.json under "${dir}" -- skipped`))
}

/*  load the summaries, derive the model label (the forced model, else the most
    frequent per-run model) and the version label (version, else commit prefix)  */
const entries: Entry[] = []
for (const file of summaryFiles) {
    let summary: Summary
    try {
        summary = JSON.parse(fs.readFileSync(file, "utf8")) as Summary
        if (typeof summary !== "object" || summary === null || !Array.isArray(summary.cases))
            throw new Error("unexpected shape")
    }
    catch (err) {
        console.error(chalk.yellow(`WARNING: unreadable summary "${file}": ` +
            `${err instanceof Error ? err.message : String(err)} -- skipped`))
        continue
    }
    let model = summary.meta?.model ?? ""
    if (model === "" || model === "(account default)") {
        const freq = new Map<string, number>()
        for (const caze of summary.cases)
            for (const run of caze.runs ?? []) {
                const first = (run.model ?? "").split(",")[0].trim()
                if (first !== "")
                    freq.set(first, (freq.get(first) ?? 0) + 1)
            }
        model = [ ...freq.entries() ].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "(account default)"
    }
    const version = (summary.meta?.pluginVersion ?? "") !== "" ?
        summary.meta.pluginVersion! : (summary.meta?.pluginCommit ?? "").slice(0, 8)
    entries.push({
        dir:     path.dirname(file),
        summary,
        model,
        version: version !== "" ? version : "?",
        time:    summary.meta?.timestamp ?? path.basename(path.dirname(file))
    })
}
if (entries.length === 0) {
    console.error(chalk.red("ERROR: no summaries found"))
    process.exit(1)
}
entries.sort((a, b) => a.time.localeCompare(b.time))

/*  aggregate the runs per (case, model) and per (group, model), where skipped
    runs carry no information and are excluded everywhere, and infrastructure
    errors (e.g. a gateway outage) say nothing about the model, so they are
    only counted separately, outside of the pass rates, costs, and durations  */
const models = [ ...new Set(entries.map((entry) => entry.model)) ].sort()
const aggAdd = (map: Map<string, Agg>, key: string, run: Run): void => {
    const agg = map.get(key) ?? { total: 0, passed: 0, costUsd: 0, durationMs: 0, infra: 0 }
    if (run.outcome === "error") {
        agg.infra += 1
        map.set(key, agg)
        return
    }
    agg.total      += 1
    agg.passed     += run.outcome === "pass" ? 1 : 0
    agg.costUsd    += run.costUsd ?? 0
    agg.durationMs += run.durationMs ?? 0
    map.set(key, agg)
}
const byCase  = new Map<string, Agg>()
const byGroup = new Map<string, Agg>()
for (const entry of entries)
    for (const caze of entry.summary.cases)
        for (const run of caze.runs ?? []) {
            if (run.outcome === "skipped")
                continue
            aggAdd(byCase,  `${caze.name}\u0000${entry.model}`, run)
            aggAdd(byGroup, `${caze.name.split("/")[0]}\u0000${entry.model}`, run)
        }
const caseNames  = [ ...new Set([ ...byCase.keys()  ].map((key) => key.split("\u0000")[0])) ].sort()
const groupNames = [ ...new Set([ ...byGroup.keys() ].map((key) => key.split("\u0000")[0])) ].sort()

/*  format one matrix cell as "passed/total $mean-cost mean-duration [+N infra]"  */
const cellText = (agg: Agg | undefined): string => {
    if (agg === undefined || (agg.total === 0 && agg.infra === 0))
        return "·"
    const infra = agg.infra > 0 ? ` +${agg.infra} infra` : ""
    if (agg.total === 0)
        return `0/0${infra}`
    return `${agg.passed}/${agg.total} $${(agg.costUsd / agg.total).toFixed(2)} ` +
        prettyMs(agg.durationMs / agg.total, { compact: true }) + infra
}

/*  build one matrix as plain text rows (header row first)  */
const matrixRows = (rows: string[], map: Map<string, Agg>, label: string): string[][] => [
    [ label, ...models ],
    ...rows.map((row) => [ row, ...models.map((model) => cellText(map.get(`${row}\u0000${model}`))) ])
]

/*  the per-summary time table (header row first)  */
const timeRows: string[][] = [
    [ "timestamp", "model", "version", "cases", "runs", "cost", "duration", "aborted" ],
    ...entries.map((entry) => {
        const runs = entry.summary.cases.flatMap((caze) => caze.runs ?? [])
            .filter((run) => run.outcome !== "skipped" && run.outcome !== "error")
        const passedCases = entry.summary.cases.filter((caze) => caze.pass).length
        const passedRuns  = runs.filter((run) => run.outcome === "pass").length
        const duration    = runs.reduce((sum, run) => sum + (run.durationMs ?? 0), 0)
        return [
            entry.time, entry.model, entry.version,
            `${passedCases}/${entry.summary.cases.length}`,
            `${passedRuns}/${runs.length}`,
            `$${(entry.summary.totalUsd ?? 0).toFixed(2)}`,
            prettyMs(duration, { compact: true }),
            entry.summary.aborted !== "" ? "yes" : ""
        ]
    })
]

/*  render rows as a padded console table, with the pass fraction of matrix
    cells colorized after padding (so the ANSI codes cannot skew the width)  */
const consoleTable = (rows: string[][], colorize: boolean): string => {
    const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)))
    return rows.map((row, i) => row.map((cell, col) => {
        let text = cell.padEnd(widths[col])
        if (colorize && i > 0 && col > 0) {
            const m = cell.match(/^(\d+)\/(\d+)/)
            if (m !== null)
                text = text.replace(m[0], m[1] === m[2] ? chalk.green(m[0]) :
                    m[1] === "0" ? chalk.red(m[0]) : chalk.yellow(m[0]))
        }
        return text
    }).join("  ").trimEnd()).join("\n")
}

/*  render rows as a Markdown pipe table  */
const markdownTable = (rows: string[][]): string => {
    const line = (row: string[]): string => `| ${row.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`
    return [ line(rows[0]), `|${rows[0].map(() => "---").join("|")}|`, ...rows.slice(1).map(line) ].join("\n")
}

/*  render rows as a sortable HTML table  */
const escapeHtml = (text: string): string =>
    text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
const htmlTable = (rows: string[][]): string =>
    `<table>\n<thead><tr>${rows[0].map((cell) =>
        `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>\n<tbody>\n${rows.slice(1).map((row) =>
        `<tr>${row.map((cell, col) => col === 0 ?
            `<th scope="row">${escapeHtml(cell)}</th>` :
            `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table>`

/*  render one SVG line chart over the summaries (x: run index, evenly spaced),
    one series per model, markers with native tooltips, series colors via the
    CSS custom properties, so the light and dark values swap with the theme  */
const svgChart = (title: string, unit: string, max: number,
    value: (entry: Entry) => number | null): string => {
    const W = 840; const H = 320
    const padL = 56; const padR = 16; const padT = 16; const padB = 72
    const x = (i: number): number => entries.length === 1 ?
        padL + (W - padL - padR) / 2 :
        padL + (W - padL - padR) * (i / (entries.length - 1))
    const y = (v: number): number => (H - padB) - (H - padB - padT) * (v / max)
    const parts: string[] = []
    for (let g = 0; g <= 4; g++) {
        const v  = max * (g / 4)
        const gy = y(v)
        parts.push(`<line class="grid" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`)
        parts.push(`<text class="tick" x="${padL - 8}" y="${gy + 4}" text-anchor="end">` +
            `${unit === "%" ? `${Math.round(v)}%` : `$${v.toFixed(0)}`}</text>`)
    }
    entries.forEach((entry, i) => {
        parts.push(`<text class="tick" transform="rotate(-40 ${x(i)} ${H - padB + 16})" ` +
            `x="${x(i)}" y="${H - padB + 16}" text-anchor="end">${escapeHtml(entry.time)}</text>`)
    })
    models.forEach((model, m) => {
        const points = entries.map((entry, i) => ({ entry, i, v: entry.model === model ? value(entry) : null }))
            .filter((point) => point.v !== null)
        if (points.length === 0)
            return
        const color = `var(--series-${(m % 8) + 1})`
        if (points.length > 1)
            parts.push(`<polyline fill="none" stroke="${color}" stroke-width="2" points="` +
                points.map((point) => `${x(point.i).toFixed(1)},${y(point.v!).toFixed(1)}`).join(" ") + "\"/>")
        for (const point of points)
            parts.push(`<circle cx="${x(point.i).toFixed(1)}" cy="${y(point.v!).toFixed(1)}" r="4" ` +
                `fill="${color}"><title>${escapeHtml(`${model}, ${point.entry.time}: ` +
                `${unit === "%" ? `${point.v!.toFixed(0)}%` : `$${point.v!.toFixed(2)}`}`)}</title></circle>`)
    })
    const legend = models.map((model, m) =>
        `<span class="key"><span class="swatch" style="background: var(--series-${(m % 8) + 1})"></span>` +
        `${escapeHtml(model)}</span>`).join("\n")
    return `<h2>${escapeHtml(title)}</h2>\n` +
        `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(title)}">\n` +
        `<line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>\n` +
        `${parts.join("\n")}\n</svg>\n<p class="legend">\n${legend}\n</p>`
}
const passRate = (entry: Entry): number | null => {
    const runs = entry.summary.cases.flatMap((caze) => caze.runs ?? [])
        .filter((run) => run.outcome !== "skipped" && run.outcome !== "error")
    return runs.length === 0 ? null : 100 * runs.filter((run) => run.outcome === "pass").length / runs.length
}
const maxCost = Math.max(10, ...entries.map((entry) => entry.summary.totalUsd ?? 0))

/*  print the console report  */
const generated = new Date().toISOString().replace(/\.\d+Z$/, "Z")
console.log(chalk.blue.bold(`\nASE test run comparison (${entries.length} runs, ${models.length} models)\n`))
console.log(chalk.blue("cases × models") + chalk.dim("  (passed/runs, mean cost, mean duration)"))
console.log(consoleTable(matrixRows(caseNames, byCase, "case"), true) + "\n")
console.log(chalk.blue("case groups × models"))
console.log(consoleTable(matrixRows(groupNames, byGroup, "group"), true) + "\n")
console.log(chalk.blue("runs over time"))
console.log(consoleTable(timeRows, false) + "\n")

/*  write the Markdown report  */
const md =
    "ASE Test Run Comparison\n=======================\n\n" +
    `Generated ${generated} from ${entries.length} run summaries, ${models.length} models. ` +
    "Cells show passed/runs, mean cost per run, and mean duration per run " +
    "(skipped runs excluded, infrastructure errors only counted as \"+N infra\"; " +
    "costs of non-Anthropic gateway models are unreliable).\n\n" +
    "## Cases × Models\n\n"       + markdownTable(matrixRows(caseNames, byCase, "case"))     + "\n\n" +
    "## Case Groups × Models\n\n" + markdownTable(matrixRows(groupNames, byGroup, "group")) + "\n\n" +
    "## Runs over Time\n\n"            + markdownTable(timeRows)                                 + "\n"
fs.mkdirSync(opts.out, { recursive: true })
fs.writeFileSync(path.join(opts.out, "COMPARISON.md"), md)

/*  write the HTML report: the same tables (sortable) plus the pass-rate and
    cost trend charts, self-contained and themed for light and dark mode  */
const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ASE Test Run Comparison</title>
<style>
:root {
    color-scheme: light;
    --surface-1:      #fcfcfb;  --page:     #f9f9f7;
    --text-primary:   #0b0b0b;  --text-secondary: #52514e;  --muted: #898781;
    --grid:           #e1e0d9;  --axis:     #c3c2b7;  --border: rgba(11, 11, 11, 0.10);
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
    --series-5: #e87ba4; --series-6: #008300; --series-7: #6250d6; --series-8: #e34948;
}
@media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
        color-scheme: dark;
        --surface-1:      #1a1a19;  --page:     #0d0d0d;
        --text-primary:   #f0efec;  --text-secondary: #c3c2b7;
        --grid:           #2c2c2a;  --axis:     #383835;  --border: rgba(255, 255, 255, 0.10);
        --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
        --series-5: #d55181; --series-6: #0ca30c; --series-7: #9085e9; --series-8: #e66767;
    }
}
:root[data-theme="dark"] {
    color-scheme: dark;
    --surface-1:      #1a1a19;  --page:     #0d0d0d;
    --text-primary:   #f0efec;  --text-secondary: #c3c2b7;
    --grid:           #2c2c2a;  --axis:     #383835;  --border: rgba(255, 255, 255, 0.10);
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
    --series-5: #d55181; --series-6: #0ca30c; --series-7: #9085e9; --series-8: #e66767;
}
body { margin: 0 auto; max-width: 1080px; padding: 24px 16px; background: var(--page);
    color: var(--text-primary); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif }
h1 { font-size: 22px } h2 { font-size: 17px; margin: 28px 0 8px }
p.sub { color: var(--text-secondary) }
table { border-collapse: collapse; background: var(--surface-1); border: 1px solid var(--border);
    font-variant-numeric: tabular-nums; margin: 8px 0; max-width: 100%; display: inline-block;
    overflow-x: auto; white-space: nowrap }
th, td { padding: 4px 10px; text-align: left; border-bottom: 1px solid var(--grid) }
thead th { cursor: pointer; color: var(--text-secondary); position: sticky; top: 0;
    background: var(--surface-1) }
tbody th { font-weight: 500 }
svg { width: 100%; height: auto; background: var(--surface-1); border: 1px solid var(--border) }
svg .grid { stroke: var(--grid); stroke-width: 1 }
svg .axis { stroke: var(--axis); stroke-width: 1 }
svg .tick { fill: var(--muted); font: 11px system-ui, sans-serif }
p.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--text-secondary) }
span.key { display: inline-flex; align-items: center; gap: 6px }
span.swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block }
</style>
<body>
<h1>ASE Test Run Comparison</h1>
<p class="sub">Generated ${generated} from ${entries.length} run summaries, ${models.length} models.
Cells show passed/runs, mean cost per run, and mean duration per run (skipped runs excluded, infrastructure errors only counted as "+N infra";
costs of non-Anthropic gateway models are unreliable). Click a column header to sort.</p>
<h2>Cases × Models</h2>
${htmlTable(matrixRows(caseNames, byCase, "case"))}
<h2>Case Groups × Models</h2>
${htmlTable(matrixRows(groupNames, byGroup, "group"))}
<h2>Runs over Time</h2>
${htmlTable(timeRows)}
${svgChart("Pass Rate over Time", "%", 100, passRate)}
${svgChart("Total Cost per Run over Time", "$", maxCost, (entry) => entry.summary.totalUsd ?? null)}
<script>
for (const table of document.querySelectorAll("table"))
    table.querySelectorAll("thead th").forEach((th, col) => th.addEventListener("click", () => {
        const dir  = th.dataset.dir === "asc" ? -1 : 1
        th.dataset.dir = dir === 1 ? "asc" : "desc"
        const body = table.querySelector("tbody")
        const num  = (text) => {
            const m = text.replace(/[$,]/g, "").match(/-?\\d+(\\.\\d+)?/)
            return m === null ? null : parseFloat(m[0])
        }
        Array.from(body.rows).sort((a, b) => {
            const ta = a.cells[col].textContent.trim()
            const tb = b.cells[col].textContent.trim()
            const na = num(ta); const nb = num(tb)
            return dir * (na !== null && nb !== null ? na - nb : ta.localeCompare(tb))
        }).forEach((row) => body.appendChild(row))
    }))
</script>
</body>
</html>
`
fs.writeFileSync(path.join(opts.out, "COMPARISON.html"), html)
console.log(chalk.dim(`written: ${path.join(opts.out, "COMPARISON.md")}, ${path.join(opts.out, "COMPARISON.html")}`))
