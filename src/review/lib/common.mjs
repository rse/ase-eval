/*
**  ASE review benchmark -- common helpers
**  Node.js built-ins only
*/

import fs            from "node:fs"
import path          from "node:path"
import crypto        from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

/*  well-known locations: the code of the benchmark (src/review/), the harness root,
    the ASE repository (its parent, used only for plugin/ and tool/), the cases,
    the documentation with the log, the shared test data, and the results  */
export const REVIEW_DIR    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const HARNESS_DIR   = path.resolve(REVIEW_DIR, "..", "..")
export const REPO_DIR      = path.resolve(HARNESS_DIR, "..")
export const CASES_DIR     = path.join(HARNESS_DIR, "cases", "review")
export const DOCS_DIR      = path.join(HARNESS_DIR, "docs", "review")
export const TESTDATA_DIR  = path.join(REVIEW_DIR, "testdata")
export const RESULTS_DIR   = path.join(HARNESS_DIR, "results", "review")

/*  the prompt of the baseline condition: the whole file is the prompt  */
export const BASELINE_PROMPT_FILE = path.join(REVIEW_DIR, "baseline-prompt.md")

/*  the test cases: every case lives under cases/review/<name>/, and its case.yaml
    (also read by the skill harness) is the only source of its change commit message
    (design rationale: DESIGN.md)  */
export const DEFAULT_CASE = "correctness-cents"
const CASES = Object.fromEntries((fs.existsSync(CASES_DIR) ? fs.readdirSync(CASES_DIR) : []).sort()
    .filter((name) => fs.existsSync(path.join(CASES_DIR, name, "case.yaml")))
    .map((name) => {
        const yaml = fs.readFileSync(path.join(CASES_DIR, name, "case.yaml"), "utf8")
        const m    = /^\s+message:\s*"([^"]*)"\s*$/m.exec(yaml)
        if (m === null)
            throw new Error(`case "${name}": no change commit message in case.yaml`)
        return [ name, { dir: path.join(CASES_DIR, name), changeMessage: m[1] } ]
    }))
export const CASE_NAMES = Object.keys(CASES)

/*  resolve a case name to its paths; throws for an unknown name  */
export function resolveCase (name = DEFAULT_CASE) {
    const c = CASES[name]
    if (c === undefined)
        throw new Error(`unknown case "${name}" (known: ${CASE_NAMES.join(", ")})`)
    return {
        name,
        dir:           c.dir,
        fixtureDir:    path.join(c.dir, "fixture"),
        expectedFile:  path.join(c.dir, "solution", "expected.json"),
        proofsDir:     path.join(c.dir, "solution", "proofs"),
        fixesFile:     path.join(c.dir, "solution", "fixes.json"),
        thresholdFile: path.join(c.dir, "thresholds.json"),
        resultsDir:    path.join(RESULTS_DIR, name),
        testdataDir:   path.join(c.dir, "testdata"),
        referenceDir:  path.join(c.dir, "reference"),
        project:       { id: "shop", name: "Shop", boxing: "white" },
        changeMessage: c.changeMessage
    }
}

/*  read and parse a JSON file  */
export function readJson (file) {
    return JSON.parse(fs.readFileSync(file, "utf8"))
}

/*  SHA-256 of a buffer or string  */
export function sha256 (data) {
    return "sha256:" + crypto.createHash("sha256").update(data).digest("hex")
}

/*  list all files below a directory (relative, POSIX separators, sorted)  */
export function listFiles (dir, skip = [ ".git" ]) {
    const result = []
    const walk = (sub) => {
        for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
            if (skip.includes(entry.name))
                continue
            const rel = sub === "" ? entry.name : `${sub}/${entry.name}`
            if (entry.isDirectory())
                walk(rel)
            else
                result.push(rel)
        }
    }
    walk("")
    return result.sort()
}

/*  digest over the names and contents of all files below a directory  */
export function dirDigest (dir) {
    const hash = crypto.createHash("sha256")
    for (const file of listFiles(dir)) {
        hash.update(file + "\0")
        hash.update(fs.readFileSync(path.join(dir, file)))
        hash.update("\0")
    }
    return "sha256:" + hash.digest("hex")
}

/*  run Git synchronously with isolated, deterministic settings  */
export function git (cwd, args, env = {}) {
    const res = spawnSync("git", [
        "-c", "user.name=Shop Team",
        "-c", "user.email=team@shop.example",
        "-c", "commit.gpgsign=false",
        "-c", "core.autocrlf=false",
        "-c", "core.hooksPath=.git/no-hooks",
        ...args
    ], { cwd, encoding: "utf8", env: { ...process.env, ...env } })
    if (res.error)
        throw res.error
    if (res.status !== 0)
        throw new Error(`git ${args.join(" ")} failed: ${(res.stderr || "").trim()}`)
    return res.stdout
}

/*  JSON serialization with sorted object keys (deterministic output)  */
export function stableStringify (value) {
    const sort = (v) => {
        if (Array.isArray(v))
            return v.map(sort)
        if (v !== null && typeof v === "object") {
            const out = {}
            for (const key of Object.keys(v).sort())
                out[key] = sort(v[key])
            return out
        }
        return v
    }
    return JSON.stringify(sort(value), null, 4) + "\n"
}

/*  round to four decimals  */
export function round4 (x) {
    return x === null || x === undefined ? null : Math.round(x * 10000) / 10000
}

/*  compare IDs like "B-2" < "B-10"  */
export function compareIds (a, b) {
    return a.localeCompare(b, "en", { numeric: true })
}
