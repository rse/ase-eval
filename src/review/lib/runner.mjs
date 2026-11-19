/*
**  ASE review benchmark -- runner building blocks (design rationale: DESIGN.md)
*/

import fs                    from "node:fs"
import os                    from "node:os"
import path                  from "node:path"
import { spawn, spawnSync }  from "node:child_process"

import { REPO_DIR, REVIEW_DIR, CASES_DIR, BASELINE_PROMPT_FILE, git } from "./common.mjs"

/*  the fixed skill invocation  */
export const PROMPT = "/ase:ase-repo-review -c HEAD -S LOW"

/*  tool permissions: read, search, and git only; no writing and no web access  */
export const ALLOWED_TOOLS = [
    "Read", "Grep", "Glob", "Skill", "Task", "Agent", "ToolSearch",
    "Bash(git:*)", "Bash(cd:*)", "PowerShell(git:*)", "PowerShell(cd:*)",
    "mcp__ase__*"
]
export const DISALLOWED_TOOLS = [ "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch" ]

/*  the baseline keeps the same rights, minus the skill and the ASE MCP tools  */
export const BASELINE_ALLOWED_TOOLS = ALLOWED_TOOLS.filter((t) => t !== "Skill" && t !== "mcp__ase__*")

/*  the prompt as the model gets it: the same text whatever line endings the checkout gave the
    file, and without the line breaks at its end; so the prompt equals the normalized file,
    not its bytes on disk  */
export function normalizePrompt (text) {
    return text.replace(/\r\n?/g, "\n").replace(/\n+$/, "")
}

/*  the measurement conditions: everything that differs between a run with ASE and a run
    without it, in one place; the runner itself has one code path (design rationale: DESIGN.md).
    usesAse says whether a run needs the built tool/, its folder on the PATH, and the
    clean-up of ASE processes, and whether thresholds and calibration apply to its results;
    promptFile names a versioned prompt file that must be committed before a paid run  */
export const CONDITIONS = {
    ase: {
        name:             "ase",
        usesAse:          true,
        prompt:           () => PROMPT,
        promptFile:       null,
        pluginDir:        path.join(REPO_DIR, "plugin"),
        mcpServers:       () => ({ ase: { command: process.execPath, args: [ path.join(REPO_DIR, "tool", "bin", "ase"), "mcp" ] } }),
        allowedTools:     ALLOWED_TOOLS,
        expectedPlugins:  [ "ase" ],
        expectedServers:  [ "ase" ],
        allowedRepoPaths: [ path.join(REPO_DIR, "plugin"), path.join(REPO_DIR, "tool") ]
    },
    baseline: {
        name:             "baseline",
        usesAse:          false,
        prompt:           () => normalizePrompt(fs.readFileSync(BASELINE_PROMPT_FILE, "utf8")),
        promptFile:       BASELINE_PROMPT_FILE,
        pluginDir:        null,
        mcpServers:       () => ({}),
        allowedTools:     BASELINE_ALLOWED_TOOLS,
        expectedPlugins:  [],
        expectedServers:  [],
        allowedRepoPaths: []
    }
}
export const CONDITION_NAMES = Object.keys(CONDITIONS)
export const DEFAULT_CONDITION = "ase"

/*  resolve a condition name to its specification; throws for an unknown name  */
export function conditionSpec (name = DEFAULT_CONDITION) {
    const c = CONDITIONS[name]
    if (c === undefined)
        throw new Error(`unknown condition "${name}" (known: ${CONDITION_NAMES.join(", ")})`)
    return { ...c, prompt: c.prompt() }
}

/*  whether a condition uses ASE; a name no record knows comes from a protocol written
    by another version of the benchmark and counts as a run with ASE, like the protocols
    written before the baseline existed  */
export function conditionUsesAse (name) {
    return CONDITIONS[name]?.usesAse ?? true
}

/*  whether the ASE tool of this working copy is built; only a run with ASE starts it  */
export function toolBuilt () {
    return fs.existsSync(path.join(REPO_DIR, "tool", "dst", "ase.js"))
}

/*  MCP configuration of a condition: exactly the ASE server, or no server at all  */
export function mcpConfig (spec = conditionSpec()) {
    return { mcpServers: spec.mcpServers() }
}

/*  command-line arguments of the claude invocation  */
export function claudeArgs ({ model, budget, mcpConfigFile = "{ase.json}" }, spec = conditionSpec()) {
    return [
        "-p", spec.prompt,
        ...(spec.pluginDir === null ? [] : [ "--plugin-dir", spec.pluginDir ]),
        "--model", model,
        "--output-format", "stream-json",
        "--verbose",
        "--max-budget-usd", String(budget),
        "--no-session-persistence",
        "--setting-sources", "",
        "--strict-mcp-config",
        "--mcp-config", mcpConfigFile,
        "--permission-mode", "dontAsk",
        "--allowedTools", ...spec.allowedTools,
        "--disallowedTools", ...DISALLOWED_TOOLS
    ]
}

/*  find Git Bash on Windows (Claude Code needs it for its Bash tool)  */
function findGitBash (env) {
    const candidates = []
    if (env.SHELL && /bash\.exe$/i.test(env.SHELL))
        candidates.push(env.SHELL)
    const res = spawnSync("where", [ "git" ], { encoding: "utf8", env })
    for (const hit of (res.stdout || "").split(/\r?\n/).filter(Boolean)) {
        let dir = path.dirname(hit)
        for (let i = 0; i < 3; i++) {
            dir = path.dirname(dir)
            candidates.push(path.join(dir, "bin", "bash.exe"))
        }
    }
    return candidates.find((c) => fs.existsSync(c)) ?? null
}

/*  environment of the child process: no inherited session or endpoint variables; the ASE
    tool folder leads the PATH unless the condition runs without ASE  */
export function childEnv ({ baseUrl = null, authTokenEnv = null, toolOnPath = true, base = process.env, platform = process.platform } = {}) {
    const env = { ...base }
    for (const name of Object.keys(env))
        if (/^(CLAUDE|ANTHROPIC_|npm_)/i.test(name) && name !== "CLAUDE_CODE_GIT_BASH_PATH")
            delete env[name]
    if (toolOnPath) {
        const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH"
        env[pathKey] = path.join(REPO_DIR, "tool", "bin") + path.delimiter + (env[pathKey] ?? "")
    }
    if (platform === "win32" && !env.CLAUDE_CODE_GIT_BASH_PATH) {
        const bash = findGitBash(env)
        if (bash)
            env.CLAUDE_CODE_GIT_BASH_PATH = bash
    }
    if (baseUrl)
        env.ANTHROPIC_BASE_URL = baseUrl
    if (authTokenEnv) {
        const token = base[authTokenEnv]
        if (!token)
            throw new Error(`environment variable ${authTokenEnv} is not set`)
        env.ANTHROPIC_AUTH_TOKEN = token
    }
    return env
}

/*  names of the environment variables relevant for the protocol (never values)  */
export function envSummary (env) {
    return Object.keys(env).filter((k) => /^(ANTHROPIC_|CLAUDE)/i.test(k)).sort()
}

/*  program to start: BENCH_CLAUDE_BIN or claude; a Node script runs through node  */
export function claudeProgram (bin = process.env.BENCH_CLAUDE_BIN || "claude") {
    return /\.(m?js)$/i.test(bin) ? { program: process.execPath, pre: [ bin ] } : { program: bin, pre: [] }
}

/*  kill a process tree  */
export function killTree (child) {
    if (!child.pid)
        return
    if (process.platform === "win32") {
        spawnSync("taskkill", [ "/pid", String(child.pid), "/T", "/F" ])
        return
    }
    try {
        process.kill(-child.pid, "SIGKILL")
    }
    catch (err) {
        child.kill("SIGKILL")
    }
}

/*  whether a process is still alive  */
export function isAlive (pid) {
    try {
        process.kill(pid, 0)
        return true
    }
    catch (err) {
        return err.code === "EPERM"
    }
}

/*  series budget: may another run start? A run can overshoot its limit
    slightly before the CLI stops it, so a margin is reserved  */
export const OVERSHOOT = 1.1
export function seriesAllows (spent, perRun, total) {
    return spent + perRun * OVERSHOOT <= total + 1e-9
}

/*  whether a plugin of the init event is built into the CLI itself  */
export function isBuiltinPlugin (p) {
    return typeof p === "object" && p !== null && (p.path === "builtin" || /@builtin$/.test(p.source ?? ""))
}

/*  isolation check of the init event, in both directions: built-in CLI plugins are allowed
    (and logged), every plugin and MCP server the condition expects must be there, and
    nothing else may be  */
export function checkInit (event, spec = conditionSpec()) {
    const problems = []
    const plugins  = Array.isArray(event.plugins) ? event.plugins : []
    const name     = (p) => typeof p === "string" ? p : p.name
    for (const p of plugins)
        if (!spec.expectedPlugins.includes(name(p)) && !isBuiltinPlugin(p))
            problems.push(`foreign plugin loaded: ${name(p)}`)
    for (const want of spec.expectedPlugins)
        if (!plugins.some((p) => name(p) === want))
            problems.push(`${want.toUpperCase()} plugin not loaded`)
    const servers = Array.isArray(event.mcp_servers) ? event.mcp_servers : []
    for (const s of servers)
        if (!spec.expectedServers.includes(s.name))
            problems.push(`foreign MCP server loaded: ${s.name}`)
    for (const want of spec.expectedServers) {
        const s = servers.find((x) => x.name === want)
        if (!s)
            problems.push(`${want.toUpperCase()} MCP server missing`)
        else if (s.status !== undefined && s.status !== "connected")
            problems.push(`${want.toUpperCase()} MCP server not connected: ${s.status}`)
    }
    return problems
}

/*  the init event a dry run shows for a condition: built-in plugins and every entry the
    condition expects stay as they are, an expected one that is missing is added, and
    everything else is dropped; so the canned transcript of one condition serves all of them  */
export function conformInit (event, spec = conditionSpec()) {
    const plugins = Array.isArray(event.plugins)     ? event.plugins     : []
    const servers = Array.isArray(event.mcp_servers) ? event.mcp_servers : []
    const name    = (p) => typeof p === "string" ? p : p.name
    return {
        ...event,
        plugins: [
            ...plugins.filter((p) => spec.expectedPlugins.includes(name(p)) || isBuiltinPlugin(p)),
            ...spec.expectedPlugins.filter((want) => !plugins.some((p) => name(p) === want)).map((want) => ({ name: want }))
        ],
        mcp_servers: [
            ...servers.filter((s) => spec.expectedServers.includes(s.name)),
            ...spec.expectedServers.filter((want) => !servers.some((s) => s.name === want)).map((want) => ({ name: want, status: "connected" }))
        ]
    }
}

/*  PIDs and command lines of running ASE processes of this working copy (R3)  */
export function aseProcesses () {
    const marker = path.join(REPO_DIR, "tool").toLowerCase()
    let rows = []
    if (process.platform === "win32") {
        const res = spawnSync("powershell", [ "-NoProfile", "-NonInteractive", "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }" ],
            { encoding: "utf8", windowsHide: true })
        rows = (res.stdout || "").split(/\r?\n/)
    }
    else {
        const res = spawnSync("ps", [ "-eo", "pid=,args=" ], { encoding: "utf8" })
        rows = (res.stdout || "").split("\n").map((l) => l.trim().replace(/^(\d+)\s+/, "$1\t"))
    }
    return rows.map((l) => l.split("\t")).filter(([ pid, cmd ]) => /^\d+$/.test(pid ?? "") && (cmd ?? "").toLowerCase().includes(marker))
        .map(([ pid, cmd ]) => ({ pid: Number(pid), cmd: cmd.trim() }))
}

/*  kill ASE processes started during the run (R3)  */
export function killLeftovers (before) {
    const known = new Set(before.map((p) => p.pid))
    const left  = aseProcesses().filter((p) => !known.has(p.pid) && p.pid !== process.pid)
    for (const p of left) {
        if (process.platform === "win32")
            killTree({ pid: p.pid })
        else {
            try {
                process.kill(p.pid, "SIGKILL")
            }
            catch (err) {
                /*  already gone  */
            }
        }
    }
    return left.map((p) => p.cmd.replace(/\s+/g, " ").slice(0, 200))
}

/*  collect all strings of a tool input (any tool, including MCP and sub-agent prompts)  */
function toolStrings (input) {
    const out  = []
    const walk = (v) => {
        if (typeof v === "string")
            out.push(v)
        else if (Array.isArray(v))
            v.forEach(walk)
        else if (v !== null && typeof v === "object")
            Object.values(v).forEach(walk)
    }
    walk(input)
    return out
}

/*  contamination check of all tool calls: any access to the benchmark itself or to the ASE
    repository outside the paths the condition legitimately uses (none for the baseline)  */
/*  whether a (normalized) tool string touches the repository only below a
    "node_modules/" directory (e.g. looking for a TypeScript compiler), which
    holds third-party packages and no benchmark answers  */
const inNodeModules = (n, repo) => {
    const rest = n.split(repo).slice(1)
    return rest.length > 0 && rest.every((tail) => /^\/(?:[^\s"']*\/)?node_modules(?:[/\s"';]|$)/.test(tail))
}

export function checkContamination (events, spec = conditionSpec()) {
    const problems = []
    /*  normalize Windows and Git Bash forms ("C:\x", "C:/x", "/c/x") to "c:/x"  */
    const norm     = (p) => p.replace(/\\/g, "/").toLowerCase().replace(/(^|[\s"'=(])\/([a-z])\//g, "$1$2:/")
    const bench    = [ norm(REVIEW_DIR), norm(CASES_DIR) ]
    const repo     = norm(REPO_DIR)
    const allowed  = spec.allowedRepoPaths.map(norm)
    for (const ev of events) {
        const content = ev?.message?.content
        if (ev.type !== "assistant" || !Array.isArray(content))
            continue
        for (const block of content) {
            if (block.type !== "tool_use")
                continue
            for (const s of toolStrings(block.input)) {
                const n = norm(s)
                if (/sollliste|cases\/review|src\/review|solution\//.test(n) || bench.some((b) => n.includes(b)))
                    problems.push(`${block.name}: access to ${s}`)
                else if (n.includes(repo) && !allowed.some((a) => n.includes(a)) && !inNodeModules(n, repo))
                    problems.push(`${block.name}: access to the ASE repository ${s}`)
            }
        }
    }
    return [ ...new Set(problems) ]
}

/*  facts from the transcript: result event, reported models, denials  */
export function transcriptFacts (events) {
    const result = [ ...events ].reverse().find((e) => e.type === "result") ?? null
    const init   = events.find((e) => e.type === "system" && e.subtype === "init") ?? null
    const models = new Set()
    if (result?.modelUsage)
        for (const m of Object.keys(result.modelUsage))
            models.add(m)
    if (init?.model)
        models.add(init.model)
    const plugins = Array.isArray(init?.plugins) ? init.plugins : []
    return {
        result,
        init,
        plugins:  plugins.map((p) => typeof p === "string" ? p : `${p.name}${isBuiltinPlugin(p) ? " (builtin)" : ""}`).sort(),
        mcp:      (Array.isArray(init?.mcp_servers) ? init.mcp_servers : []).map((s) => `${s.name}:${s.status}`).sort(),
        reported: [ ...models ].sort(),
        cost:     typeof result?.total_cost_usd === "number" ? result.total_cost_usd : null,
        denials:  Array.isArray(result?.permission_denials) ? result.permission_denials.length : null,
        text:     typeof result?.result === "string" ? result.result : null
    }
}

/*  version of the Claude Code CLI  */
export function cliVersion (program, pre) {
    const res = spawnSync(program, [ ...pre, "--version" ], { encoding: "utf8" })
    return res.status === 0 ? res.stdout.trim() : null
}

/*  ASE version and commit of the working copy  */
export function aseInfo () {
    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_DIR, "plugin", ".claude-plugin", "plugin.json"), "utf8"))
    let commit = null, dirty = null
    try {
        commit = git(REPO_DIR, [ "rev-parse", "HEAD" ]).trim()
        dirty  = git(REPO_DIR, [ "status", "--porcelain", "--", "plugin", "tool" ]).trim() !== ""
    }
    catch (err) {
        commit = null
    }
    return { version: manifest.version, commit, working_copy_modified: dirty }
}

/*  candidate locations of a per-user ASE configuration (protocol only)  */
export function userAseConfig () {
    const home = os.homedir()
    const candidates = [
        process.env.XDG_CONFIG_HOME && path.join(process.env.XDG_CONFIG_HOME, "ase", "config.yaml"),
        path.join(home, ".config", "ase", "config.yaml"),
        process.env.APPDATA && path.join(process.env.APPDATA, "ase", "config.yaml"),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ase", "config.yaml"),
        path.join(home, "Library", "Preferences", "ase", "config.yaml")
    ].filter(Boolean)
    return candidates.filter((c) => fs.existsSync(c))
}

/*  create a fresh result folder; never overwrite  */
export function createRunDir (parent, name) {
    const dir = path.join(parent, name)
    if (fs.existsSync(dir))
        throw new Error(`result folder already exists: ${dir}`)
    fs.mkdirSync(dir, { recursive: true })
    return dir
}

/*  UTC time stamp for folder names  */
export function stamp (date = new Date()) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
}

/*  short model name for folder names  */
export function modelShort (model) {
    return model.replace(/^claude-/, "").replace(/[^A-Za-z0-9.-]/g, "_")
}

/*  run the child and collect its stream-json output  */
export function runChild ({ program, args, cwd, env, timeoutMs, transcriptFile, stderrFile, onInit, graceMs = 5000 }) {
    return new Promise((resolve) => {
        const out     = fs.createWriteStream(transcriptFile)
        const err     = fs.createWriteStream(stderrFile)
        const events  = []
        let   stopped = null
        let   buffer  = ""
        let   done    = false
        let   grace   = null
        let   child   = null
        let   timer   = null
        const finish = (code) => {
            if (done)
                return
            done = true
            clearTimeout(timer)
            clearTimeout(grace)
            handle(buffer)
            buffer = ""
            out.end()
            err.end()
            resolve({ events, exitCode: code, stopped, pid: child?.pid ?? null })
        }
        /*  resolve even if a surviving descendant keeps the pipes open  */
        const armGrace = () => {
            if (grace === null)
                grace = setTimeout(() => finish(null), graceMs)
        }
        const handle = (line) => {
            if (line.trim() === "")
                return
            let ev
            try {
                ev = JSON.parse(line)
            }
            catch (e) {
                return
            }
            events.push(ev)
            if (ev.type === "system" && ev.subtype === "init" && stopped === null) {
                const problems = onInit(ev)
                if (problems.length > 0) {
                    stopped = { status: "error", reason: "isolation", details: problems }
                    killTree(child)
                    armGrace()
                }
            }
        }
        try {
            child = spawn(program, args, {
                cwd, env, stdio: [ "ignore", "pipe", "pipe" ],
                detached: process.platform !== "win32", windowsHide: true
            })
        }
        catch (e) {
            stopped = { status: "error", reason: "start", details: [ e.message ] }
            finish(null)
            return
        }
        timer = setTimeout(() => {
            stopped = stopped ?? { status: "aborted", reason: "time" }
            killTree(child)
            armGrace()
        }, timeoutMs)
        /*  decode as a stream, so multibyte characters split across chunks stay intact  */
        child.stdout.setEncoding("utf8")
        child.stdout.on("data", (text) => {
            out.write(text)
            buffer += text
            let i
            while ((i = buffer.indexOf("\n")) >= 0) {
                handle(buffer.slice(0, i))
                buffer = buffer.slice(i + 1)
            }
        })
        child.stderr.on("data", (chunk) => err.write(chunk))
        child.on("error", (e) => {
            stopped = stopped ?? { status: "error", reason: "start", details: [ e.message ] }
            finish(null)
        })
        child.on("exit", () => {
            clearTimeout(timer)
            armGrace()
        })
        child.on("close", (code) => finish(code))
    })
}
