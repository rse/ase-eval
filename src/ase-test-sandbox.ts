/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as os   from "node:os"
import * as path from "node:path"
import * as url  from "node:url"

import { execa } from "execa"
import YAML      from "yaml"

import type { TestCase } from "./ase-test-case.js"

/*  the harness root (this module lives in "<harness>/src/") and the repository root (its parent)  */
export const harnessRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..")
export const repoRoot    = path.resolve(harnessRoot, "..")

/*  a fully isolated per-run sandbox: a private HOME (XDG directories,
    Claude settings, and credentials) plus a private project directory
    (with its own ".ase/" state, task store, and service port)  */
export type Sandbox = {
    root:    string
    home:    string
    project: string
    env:     Record<string, string>
    baseRef: string
    mcpServers: Record<string, Record<string, unknown>>
}

/*  run a Git command in the sandbox project  */
const git = async (sandbox: Pick<Sandbox, "project" | "env">, args: string[]) =>
    execa("git", args, { cwd: sandbox.project, env: sandbox.env, extendEnv: false, stdin: "ignore", timeout: 60 * 1000 })

/*  ensure the agent tool can authenticate inside the sandboxed HOME: an API key or
    OAuth token environment variable is passed through, else the OAuth credentials
    file of the real HOME is copied into the sandboxed one  */
const credentials = (home: string, env: Record<string, string>): void => {
    if (process.env.ANTHROPIC_API_KEY !== undefined)
        env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
    else if (process.env.CLAUDE_CODE_OAUTH_TOKEN !== undefined)
        env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN
    else {
        const file = path.join(os.homedir(), ".claude", ".credentials.json")
        if (!fs.existsSync(file))
            throw new Error("no agent tool credentials found: set ANTHROPIC_API_KEY or " +
                "CLAUDE_CODE_OAUTH_TOKEN, or login once so \"~/.claude/.credentials.json\" exists")
        fs.copyFileSync(file, path.join(home, ".claude", ".credentials.json"))
    }
}

/*  create the sandbox of a single test run and materialize the fixture of the case:
    the optional Git repository, the ASE project configuration, the seeded task store,
    the fixture file tree, and the optional change commit, with the final commit
    serving as the baseline of the Git changeset diff oracle  */
export const sandboxCreate = async (caze: TestCase, run: number): Promise<Sandbox> => {
    const slug = caze.name.replace(/[^a-zA-Z0-9]+/g, "-")
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), `ase-test-${slug}-r${run}-`))
    try {
        return await sandboxPopulate(caze, root)
    }
    catch (err) {
        /*  a half-created sandbox has no owner to tear it down, so remove it here  */
        await fs.promises.rm(root, { recursive: true, force: true })
        throw err
    }
}

/*  populate a fresh sandbox root with the environment and the fixture  */
const sandboxPopulate = async (caze: TestCase, root: string): Promise<Sandbox> => {
    const home    = path.join(root, "home")
    const project = path.join(root, "project")
    await fs.promises.mkdir(path.join(home, ".claude"),  { recursive: true })
    await fs.promises.mkdir(path.join(project, ".ase"),  { recursive: true })

    /*  the sandboxed environment, assembled in three passes with the final policy:
        (1) everything of the developer's shell EXCEPT agent tool, ASE, tmux, and
        Copilot state and common credential variables (the session runs autonomous
        skill code), plus a controlled HOME and XDG directories and the built "ase"
        CLI on the PATH (required by the MCP server of the plugin); (2) PLUS exactly
        one agent tool credential; (3) PLUS the optional gateway endpoint and tuning  */
    const env: Record<string, string> = {}
    for (const [ key, value ] of Object.entries(process.env))
        if (value !== undefined && !/^(TMUX|COPILOT_|ASE_|CLAUDE|ANTHROPIC_|GITHUB_|GH_|AWS_|NPM_TOKEN$|NODE_AUTH_TOKEN$|OPENAI_|GOOGLE_|GEMINI_)/.test(key))
            env[key] = value
    env.HOME               = home
    env.XDG_CONFIG_HOME    = path.join(home, ".config")
    env.XDG_STATE_HOME     = path.join(home, ".local", "state")
    env.PATH               = `${path.join(repoRoot, "tool", "bin")}${path.delimiter}${process.env.PATH ?? ""}`
    env.NO_UPDATE_NOTIFIER = "1"
    env.ASE_HEADLESS       = "true"
    env.GIT_TERMINAL_PROMPT = "0"
    env.MCP_TIMEOUT        = process.env.MCP_TIMEOUT ?? "120000"

    /*  optionally load all MCP tool schemas upfront instead of deferring them behind
        "ToolSearch", whose "tool_reference" results a gateway may not expand for
        non-Anthropic models (see https://code.claude.com/docs/en/mcp.md)  */
    if (process.env.ASE_TEST_TOOL_SEARCH === "off")
        env.ENABLE_TOOL_SEARCH = "false"
    credentials(home, env)

    /*  optionally route the sessions through an Anthropic-compatible gateway (e.g. a
        LiteLLM proxy in front of a local model): pass through the endpoint and model settings  */
    for (const [ key, value ] of Object.entries(process.env))
        if (value !== undefined
            && /^(ANTHROPIC_BASE_URL|ANTHROPIC_AUTH_TOKEN|ANTHROPIC_(DEFAULT_[A-Z]+_)?MODEL|CLAUDE_CODE_(AUTO_COMPACT_WINDOW|MAX_OUTPUT_TOKENS|DISABLE_NONESSENTIAL_TRAFFIC))$/.test(key))
            env[key] = value

    /*  keep the account-level claude.ai cloud connectors out of the session, and
        seal the answer keys (e.g. the expected probe values of "ase_compat" in the
        tool sources, and the oracles of the harness) against the file reading tools
        (the "//" prefix denotes an absolute path, and the "Read" rules also cover
        "Grep" and "Glob"; "Bash" stays a known gap, as the skills need it)  */
    const sealed = [ path.join(repoRoot, "tool", "src"), harnessRoot ]
    await fs.promises.writeFile(path.join(home, ".claude", "settings.json"),
        JSON.stringify({
            disableClaudeAiConnectors: true,
            permissions: { deny: sealed.map((dir) => `Read(/${dir}/**)`) }
        }), "utf8")

    /*  materialize the fixture  */
    const sandbox: Sandbox = { root, home, project, env, baseRef: "", mcpServers: {} }

    /*  the requested MCP servers of the developer's agent tool configuration (only
        their transport type and URL, never any headers or credentials), e.g. a
        gateway's web search for the searching and researching skills  */
    if (caze.fixture.mcp.length > 0) {
        let servers: Record<string, { type?: string, url?: string }> = {}
        try {
            const config = JSON.parse(await fs.promises.readFile(path.join(os.homedir(), ".claude.json"), "utf8")) as
                { mcpServers?: Record<string, { type?: string, url?: string }> }
            servers = config.mcpServers ?? {}
        }
        catch (_err) {
            /*  no (readable) agent tool configuration: reported per server below  */
        }
        for (const name of caze.fixture.mcp) {
            const server = servers[name]
            if (server?.url === undefined || (server.type !== "http" && server.type !== "sse"))
                throw new Error(`fixture MCP server "${name}" is no HTTP/SSE server of ~/.claude.json`)
            sandbox.mcpServers[name] = { type: server.type, url: server.url }
        }
    }
    if (caze.fixture.files !== "")
        await fs.promises.cp(caze.fixture.files, project, { recursive: true })
    if (caze.fixture.config !== null)
        await fs.promises.writeFile(path.join(project, ".ase", "config.yaml"),
            YAML.stringify(caze.fixture.config), "utf8")
    if (caze.fixture.tasks.length > 0) {
        const store = path.join(project, ".ase", "task")
        await fs.promises.mkdir(store, { recursive: true })
        await fs.promises.writeFile(path.join(store, "PROJECT.yaml"),
            YAML.stringify({ id: "project", lifecycle: caze.fixture.lifecycle, idscheme: "slug" }), "utf8")
        for (const task of caze.fixture.tasks)
            await fs.promises.copyFile(task, path.join(store, path.basename(task)))
    }
    if (caze.fixture.git) {
        await git(sandbox, [ "init", "--initial-branch", "master" ])
        await git(sandbox, [ "config", "user.name",  "ASE Test" ])
        await git(sandbox, [ "config", "user.email", "ase-test@localhost" ])
        const change = caze.fixture.change
        if (change === null) {
            await git(sandbox, [ "add", "--all" ])
            await git(sandbox, [ "commit", "--allow-empty", "--no-verify", "-m", "fixture" ])
        }
        else {
            /*  a base commit plus a change commit on top (e.g. the change under review),
                with neutral messages, fixed dates, and verbatim line endings, so the line
                numbers of the change commit are deterministic and nothing hints at the case  */
            const commit = async (message: string, date: string) => {
                await git(sandbox, [ "add", "--all" ])
                await git({ ...sandbox, env: { ...sandbox.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } },
                    [ "commit", "--allow-empty", "--no-verify", "-q", "-m", message ])
            }
            await git(sandbox, [ "config", "core.autocrlf", "false" ])
            await commit("Initial version", "2026-05-04T09:00:00Z")
            await fs.promises.cp(change.files, project, { recursive: true })
            for (const file of change.delete)
                await fs.promises.rm(path.join(project, file), { force: true })
            await commit(change.message, "2026-05-11T14:30:00Z")
        }
        const { stdout } = await git(sandbox, [ "rev-parse", "HEAD" ])
        sandbox.baseRef = stdout.trim()
    }

    /*  the optional setup script of the case, run in the project after the fixture
        commit (e.g. branches, an in-progress merge, staged and unstaged hunks),
        where a tag "ase-test-base" it creates moves the baseline of the changeset diff  */
    if (caze.fixture.setup !== "") {
        const setup = await execa("bash", [ caze.fixture.setup ], {
            cwd: project, env: { ...env, CASE_DIR: caze.dir }, extendEnv: false,
            stdin: "ignore", timeout: 120 * 1000, reject: false, all: true
        })
        if (setup.exitCode !== 0)
            throw new Error(`fixture setup "${path.basename(caze.fixture.setup)}" failed (exit ${setup.exitCode}): ` +
                `${(setup.all ?? "").split("\n").slice(-5).join(" / ")}`)
        if (caze.fixture.git) {
            const tag = await git(sandbox, [ "rev-parse", "--verify", "--quiet", "ase-test-base^{commit}" ]).catch(() => null)
            if (tag !== null && tag.exitCode === 0 && tag.stdout.trim() !== "")
                sandbox.baseRef = tag.stdout.trim()
        }
    }

    /*  link the requested packages of the harness (e.g. "typescript", which the
        fixtures declare but never install) into the project, so a session can run
        its build instead of searching the host for it, invisible to Git (and with
        it to every changeset and "gitDiff" oracle)  */
    if (caze.fixture.nodeModules.length > 0) {
        const modules = path.join(project, "node_modules")
        await fs.promises.mkdir(path.join(modules, ".bin"), { recursive: true })
        for (const name of caze.fixture.nodeModules) {
            const source = path.join(harnessRoot, "node_modules", name)
            const target = path.join(modules, name)
            await fs.promises.mkdir(path.dirname(target), { recursive: true })
            await fs.promises.symlink(source, target, "dir")
            const pkg = JSON.parse(await fs.promises.readFile(path.join(source, "package.json"), "utf8")) as
                { name?: string, bin?: string | Record<string, string> }
            const bins = typeof pkg.bin === "string" ? { [(pkg.name ?? name).replace(/^@[^/]+\//, "")]: pkg.bin } : (pkg.bin ?? {})
            for (const [ bin, file ] of Object.entries(bins))
                await fs.promises.symlink(path.join(source, file), path.join(modules, ".bin", bin), "file")
        }
        if (caze.fixture.git) {
            /*  the build output (the "outDir" of a TypeScript project), which a
                session running the then working build emits, is invisible, too  */
            const ignores = [ "node_modules/" ]
            try {
                const tsconfig = JSON.parse(await fs.promises.readFile(path.join(project, "tsconfig.json"), "utf8")) as
                    { compilerOptions?: { outDir?: string } }
                const outDir = tsconfig.compilerOptions?.outDir?.replace(/^\.\//, "").replace(/\/+$/, "") ?? ""
                if (outDir !== "" && !outDir.startsWith(".."))
                    ignores.push(`${outDir}/`)
            }
            catch (_err) {
                /*  no (plain JSON) "tsconfig.json": no build output to hide  */
            }
            await fs.promises.appendFile(path.join(project, ".git", "info", "exclude"), ignores.map((e) => `${e}\n`).join(""), "utf8")
        }
    }

    /*  pre-start the ASE service of the project, so the MCP server of the plugin
        connects on the fast path instead of a cold service start, which under many
        parallel sessions can exceed the MCP connect timeout of the agent tool  */
    await execa("ase", [ "service", "start" ], {
        cwd: project, env, extendEnv: false,
        stdin: "ignore", timeout: 120 * 1000, reject: false
    })
    return sandbox
}

/*  tear down a sandbox: stop the on-demand spawned ASE service of the project
    (it would linger for its 30 minute idle timeout otherwise) and remove the
    sandbox directory (unless it has to be kept for inspection)  */
export const sandboxTeardown = async (sandbox: Sandbox, keep: boolean): Promise<void> => {
    await execa("ase", [ "service", "stop" ], {
        cwd: sandbox.project, env: sandbox.env, extendEnv: false,
        stdin: "ignore", timeout: 30 * 1000, reject: false
    })
    if (!keep)
        await fs.promises.rm(sandbox.root, { recursive: true, force: true })
}
