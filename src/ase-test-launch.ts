/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs       from "node:fs"
import * as path     from "node:path"
import * as readline from "node:readline"

import { execa }     from "execa"
import chalk         from "chalk"
import picomatch     from "picomatch"

import { caseDiscover }  from "./ase-test-case.js"
import { harnessRoot }   from "./ase-test-sandbox.js"

/*  one entry of the checkbox picker ("value" is the id behind the label)  */
export type PickItem = { label: string, hint: string, value: string }

/*  render the checkbox picker: one line per item, with cursor and check marks
    (exported pure, so the rendering and toggling logic is testable offline)  */
export const pickerRender = (title: string, items: PickItem[], cursor: number, selected: boolean[]): string[] => [
    chalk.blue.bold(title) + chalk.dim("  (↑/↓ move, SPACE toggle, RETURN confirm, q abort)"),
    ...items.map((item, i) =>
        `${i === cursor ? chalk.blue("❯") : " "} ${selected[i] ? chalk.green("◉") : "◯"} ` +
        `${i === cursor ? chalk.bold(item.label) : item.label}` +
        (item.hint !== "" ? ` ${chalk.dim(item.hint)}` : ""))
]

/*  toggle one picker entry, where entry 0 of a picker with a "select all"
    pseudo entry toggles every real entry (exported pure for testing)  */
export const pickerToggle = (selected: boolean[], cursor: number, selectAll: boolean): boolean[] => {
    const next = [ ...selected ]
    if (selectAll && cursor === 0) {
        const all = !selected.slice(1).every((on) => on)
        for (let i = 1; i < next.length; i++)
            next[i] = all
    }
    else
        next[cursor] = !next[cursor]
    if (selectAll)
        next[0] = next.slice(1).every((on) => on)
    return next
}

/*  run the interactive checkbox picker and resolve to the selected real-item
    indices (without the optional "select all" pseudo entry), or null on abort  */
const pick = (title: string, items: PickItem[], selectAll: boolean): Promise<number[] | null> => {
    const list = selectAll ? [ { label: "select all tests", hint: "", value: "" }, ...items ] : items
    let cursor   = 0
    let selected = list.map(() => false)
    let lines    = 0
    const draw = (): void => {
        if (lines > 0)
            process.stdout.write(`\x1b[${lines}A\x1b[J`)
        const out = pickerRender(title, list, cursor, selected)
        process.stdout.write(out.join("\n") + "\n")
        lines = out.length
    }
    return new Promise((resolve) => {
        readline.emitKeypressEvents(process.stdin)
        process.stdin.setRawMode(true)
        process.stdin.resume()
        draw()
        const done = (result: number[] | null): void => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            process.stdin.removeListener("keypress", onKey)
            resolve(result)
        }
        const onKey = (_chunk: string, key: { name?: string, ctrl?: boolean }): void => {
            if (key.ctrl === true && key.name === "c")
                done(null)
            else if (key.name === "q" || key.name === "escape")
                done(null)
            else if (key.name === "up"   || key.name === "k") {
                cursor = (cursor + list.length - 1) % list.length
                draw()
            }
            else if (key.name === "down" || key.name === "j") {
                cursor = (cursor + 1) % list.length
                draw()
            }
            else if (key.name === "space") {
                selected = pickerToggle(selected, cursor, selectAll)
                draw()
            }
            else if (key.name === "return") {
                const offset  = selectAll ? 1 : 0
                const indices = selected.map((on, i) => (on && i >= offset ? i - offset : -1))
                    .filter((i) => i >= 0)
                done(indices)
            }
        }
        process.stdin.on("keypress", onKey)
    })
}

/*  the launcher's own command line: the test and model selection and the
    confirmation, split off from the options passed through to every runner
    (exported pure, so the splitting is testable offline)  */
export type LaunchArgs = {
    tests: string[] | null, models: string[] | null, refModel: string | null, yes: boolean, passThrough: string[]
}
export const parseArgv = (argv: string[]): LaunchArgs => {
    const result: LaunchArgs = { tests: null, models: null, refModel: null, yes: false, passThrough: [] }
    const items = (name: string, value: string | undefined): string[] => {
        const list = (value ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "")
        if (list.length === 0)
            throw new Error(`option ${name} needs a comma-separated list`)
        return list
    }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        const opt = /^(--tests|--models)(?:=(.*))?$/.exec(arg)
        const ref = /^--ref-model(?:=(.*))?$/.exec(arg)
        if (ref !== null) {
            const value = ref[1] !== undefined ? ref[1] : argv[++i]
            if ((value ?? "") === "")
                throw new Error("option --ref-model needs a model id")
            result.refModel = value
        }
        else if (opt !== null) {
            const value = opt[2] !== undefined ? opt[2] : argv[++i]
            if (opt[1] === "--tests")
                result.tests  = items(opt[1], value)
            else
                result.models = items(opt[1], value)
        }
        else if (arg === "--yes")
            result.yes = true
        else
            result.passThrough.push(arg)
    }
    return result
}

/*  the command line that repeats this exact run (exported pure for testing);
    a glob character gets quoted, so the shell passes it through verbatim  */
export const repeatLine = (tests: string[], models: string[], refModel: string, passThrough: string[]): string => {
    const quote = (s: string) => /^[A-Za-z0-9._,=/@:-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`
    return [ "./launch_tests.sh",
        "--tests",     quote(tests.join(",")),
        "--models",    quote(models.join(",")),
        "--ref-model", quote(refModel),
        "--yes", ...passThrough.map(quote) ].join(" ")
}

/*  the default reference model of the judge and the simulator, which stay fixed
    across all tested models, so no model grades itself or plays its own user  */
const REF_MODEL_DEFAULT = "eu.anthropic.claude-opus-5-5"

/*  fetch the available models from the agent tool via the "initialize"
    control request of its stream-json interface  */
const modelList = async (): Promise<PickItem[]> => {
    const request = JSON.stringify({ type: "control_request", request_id: "1", request: { subtype: "initialize" } })
    const args    = [ "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose" ]
    const result  = await execa("claude", args, { input: `${request}\n`, reject: false, timeout: 120000 })
    for (const line of (result.stdout ?? "").split("\n")) {
        let msg: any
        try {
            msg = JSON.parse(line)
        }
        catch {
            continue
        }
        if (msg?.type === "control_response") {
            const models = (msg.response?.response?.models ?? []) as
                { value: string, displayName?: string, resolvedModel?: string }[]

            /*  force the resolved model id: the listing "value" can be a UI
                alias (e.g. "sonnet"), which the SDK rejects as unrecognized  */
            return models.map((model) => {
                const resolved = (model.resolvedModel ?? "") !== "" ? model.resolvedModel! : model.value
                return {
                    label: model.value,
                    hint:  `(${model.displayName ?? ""}${resolved !== model.value ? ` -> ${resolved}` : ""})`,
                    value: resolved
                }
            })
        }
    }
    throw new Error("model listing failed: no control_response from \"claude\" " +
        `(${result.exitCode !== 0 ? `exit code ${result.exitCode}` : "no models"})`)
}

/*  matcher for ANSI color sequences (built without a control-character
    regex literal) to de-colorize the runner output before parsing  */
const ansi = new RegExp(`${String.fromCharCode(0x1b)}\\[[0-9;]*m`, "g")

/*  the progress state of one per-model runner  */
type Runner = {
    model:    string
    slug:     string
    total:    number
    done:     number
    passed:   number
    costUsd:  number
    last:     string
    exitCode: number | null
}

/*  render the progress line of one runner  */
const runnerLine = (runner: Runner): string => {
    const width  = 16
    const filled = runner.total > 0 ?
        Math.min(width, Math.max(0, Math.round(width * (runner.done / runner.total)))) : 0
    const bar    = chalk.blue("▮".repeat(filled)) + chalk.dim("▯".repeat(width - filled))
    const state  = runner.exitCode === null ? chalk.dim(runner.last || "running") :
        runner.exitCode === 0 ? chalk.green("done") : chalk.red(`done (exit ${runner.exitCode})`)
    return `${runner.model.padEnd(34)} ${bar} ${runner.done}/${runner.total} runs, ` +
        `${runner.passed} passed, $${runner.costUsd.toFixed(2)}  ${state}`
}

/*  main control flow  */
const main = async (): Promise<void> => {
    const opts        = parseArgv(process.argv.slice(2))
    const interactive = opts.tests === null || opts.models === null || !opts.yes
    if (interactive && (!process.stdin.isTTY || !process.stdout.isTTY))
        throw new Error("interactive terminal required (or pass --tests, --models, and --yes)")

    /*  step 1: pick the test cases ("select all tests" as the first entry),
        or resolve the globs of --tests against the discovered cases  */
    const cases = caseDiscover(path.join(harnessRoot, "cases"))
    let selectedCases: typeof cases
    if (opts.tests !== null) {
        const matchers = opts.tests.map((glob) => ({ glob, match: picomatch(glob) }))
        for (const matcher of matchers)
            if (!cases.some((caze) => matcher.match(caze.name)))
                throw new Error(`no case matches the glob "${matcher.glob}"`)
        selectedCases = cases.filter((caze) => matchers.some((matcher) => matcher.match(caze.name)))
    }
    else {
        const caseItems = cases.map((caze) => ({
            label: caze.name,
            hint:  `(runs: ${caze.runs}, minPass: ${caze.minPass})`,
            value: caze.name
        }))
        let pickedCases: number[] | null = null
        while (pickedCases === null || pickedCases.length === 0) {
            pickedCases = await pick("Select the tests to run:", caseItems, true)
            if (pickedCases === null)
                throw new Error("aborted -- no tests were run")
        }
        selectedCases = pickedCases.map((i) => cases[i])
    }

    /*  step 2: pick the models (no pre-selection, no "select all"),
        or take the ids of --models as they are (already resolved)  */
    let models: string[]
    if (opts.models !== null)
        models = opts.models
    else {
        console.log(chalk.dim("fetching the available models..."))
        const modelItems = await modelList()
        let pickedModels: number[] | null = null
        while (pickedModels === null || pickedModels.length === 0) {
            pickedModels = await pick("Select the models to run the tests with:", modelItems, false)
            if (pickedModels === null)
                throw new Error("aborted -- no tests were run")
        }
        models = pickedModels.map((i) => modelItems[i].value)
    }

    /*  step 3: confirm the matrix, as every run burns real tokens  */
    const refModel = opts.refModel ?? process.env.ASE_TEST_REF_MODEL ?? REF_MODEL_DEFAULT
    const runsPerModel = selectedCases.reduce((sum, caze) => sum + caze.runs, 0)
    console.log(`\n${selectedCases.length} test(s) x ${models.length} model(s), ` +
        `${runsPerModel} run(s) per model, ${runsPerModel * models.length} run(s) in total, ` +
        `judge and simulator: ${refModel}.`)
    console.log(chalk.yellow("WARNING: every run burns real tokens and costs actual money."))
    if (!opts.yes) {
        const answer = await new Promise<string>((resolve) => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
            rl.question("Run now? [y/N] ", (text) => { rl.close(); resolve(text) })
        })
        if (answer !== "y" && answer !== "Y")
            throw new Error("aborted -- no tests were run")
    }

    /*  step 4: launch one runner process per model, each into its own
        results directory, with the full model forcing of run_all_tests.sh  */
    const timestamp = new Date().toISOString().replace(/\.\d+Z$/, "").replace(/[T:]/g, "-")
    const globs     = selectedCases.map((caze) => caze.name)
    const runners: Runner[] = []
    const children: Promise<void>[] = []
    const childProcs: ReturnType<typeof execa>[] = []
    for (const model of models) {
        const slug       = model.replace(/[^A-Za-z0-9._-]+/g, "-")
        const resultsDir = path.join(harnessRoot, "results", `${timestamp}-${slug}`)
        fs.mkdirSync(resultsDir, { recursive: true })
        const log    = fs.createWriteStream(path.join(resultsDir, "launcher.log"))
        const runner: Runner = {
            model, slug, total: runsPerModel,
            done: 0, passed: 0, costUsd: 0, last: "", exitCode: null
        }
        runners.push(runner)
        const env: Record<string, string> = { ...process.env as Record<string, string> }
        const forced = [
            "ASE_TEST_MODEL", "ANTHROPIC_MODEL",
            "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL"
        ]
        for (const name of forced)
            env[name] = model
        for (const name of [ "ASE_TEST_JUDGE_MODEL", "ASE_TEST_SIM_MODEL", "ASE_TEST_SIM_FORCE" ])
            env[name] = refModel

        /*  gateway models get no prompt caching and are slower, so their budgets
            and timeouts are scaled up  */
        if (env.ASE_TEST_BUDGET_FACTOR === undefined && !/anthropic\.claude/.test(model))
            env.ASE_TEST_BUDGET_FACTOR = "3"
        if (env.ASE_TEST_TIME_FACTOR === undefined && !/anthropic\.claude/.test(model))
            env.ASE_TEST_TIME_FACTOR = "2"
        const argv  = [ "--import", "tsx", "src/ase-test.ts", ...globs,
            `--results=${resultsDir}`, ...opts.passThrough ]
        const child = execa("node", argv, { cwd: harnessRoot, env, reject: false, all: true, buffer: false })
        childProcs.push(child)
        const input = readline.createInterface({ input: child.all! })
        /*  only the final report line of a run counts ("<mark> <case> run <n> (<duration>, $<cost>..."),
            never a warning about it like "⚠ <case> run <n> (retry): evaluation failed (...)", and
            each run at most once  */
        const seen = new Set<string>()
        input.on("line", (raw) => {
            log.write(`${raw}\n`)
            const line = raw.replace(ansi, "")
            const run  = /^([✔✘−⚠]) (\S+ run \d+) \([^,()]+, \$\d+\.\d+/.exec(line)
            if (run !== null && !seen.has(run[2])) {
                seen.add(run[2])
                runner.done   += 1
                runner.passed += run[1] === "✔" ? 1 : 0
                const cost = /\$(\d+\.\d+)/.exec(line)
                if (cost !== null)
                    runner.costUsd += parseFloat(cost[1])
            }
            else if (/^▸ /.test(line))
                runner.last = line.slice(2, 60)
            draw()
        })
        children.push(child.then(({ exitCode }) => {
            runner.exitCode = exitCode ?? 1
            log.end()
            draw()
        }))
    }

    /*  step 5: progress visualization (one line per model, redrawn in place)  */
    let lines = 0
    const draw = (): void => {
        if (lines > 0)
            process.stdout.write(`\x1b[${lines}A\x1b[J`)
        const out = runners.map((runner) => runnerLine(runner))
        process.stdout.write(out.join("\n") + "\n")
        lines = out.length
    }
    /*  an interrupt from the terminal reaches the runners directly (same process
        group), so the launcher only waits for their teardown, while a targeted
        SIGTERM is forwarded to them  */
    process.on("SIGINT",  () => { /*  wait for the runners  */ })
    process.on("SIGTERM", () => {
        for (const child of childProcs)
            child.kill("SIGTERM")
    })
    console.log("")
    draw()
    await Promise.all(children)

    /*  step 6: refresh the comparison report over all results  */
    console.log("")
    await execa("node", [ "--import", "tsx", "src/ase-test-compare.ts" ],
        { cwd: harnessRoot, stdio: "inherit", reject: false })
    /*  the verdict per runner from its summary: a runner whose executed cases
        all passed is a PASS even when the cost ceiling skipped further runs (it
        exits non-zero), and only an unreadable summary falls back to the exit code  */
    const worst = Math.max(...runners.map((runner) => runner.exitCode ?? 1))
    for (const runner of runners) {
        let verdict = runner.exitCode === 0 ? chalk.green("PASS") : chalk.red("FAIL")
        try {
            const file    = path.join(harnessRoot, "results", `${timestamp}-${runner.slug}`, "summary.json")
            const summary = JSON.parse(fs.readFileSync(file, "utf8")) as
                { cases?: { pass?: boolean, incomplete?: boolean, runs?: { outcome?: string }[] }[], aborted?: string }
            const cases   = summary.cases ?? []
            const failed  = cases.some((caze) => caze.pass !== true && caze.incomplete !== true
                && (caze.runs ?? []).some((run) => run.outcome !== "skipped"))
            const aborted = (summary.aborted ?? "") !== ""
            verdict = failed ? chalk.red("FAIL") :
                aborted ? chalk.yellow(`PASS (aborted: ${summary.aborted})`) : chalk.green("PASS")
        }
        catch (_err) {
            /*  keep the exit code based verdict  */
        }
        console.log(`${verdict} ${runner.model} ` + chalk.dim(`(results/${timestamp}-${runner.slug})`))
    }

    /*  one copyable command line that repeats this exact run  */
    console.log(chalk.dim(`repeat: ${repeatLine(globs, models, refModel, opts.passThrough)}`))
    process.exit(worst)
}

/*  entry point (skipped when imported for the offline picker tests)  */
if (process.argv[1] !== undefined && /ase-test-launch\.(?:ts|js)$/.test(process.argv[1]))
    main().catch((err: Error) => {
        console.error(chalk.red(err.message))
        process.exit(2)
    })
