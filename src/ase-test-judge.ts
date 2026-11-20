/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"

import type { Sandbox }       from "./ase-test-sandbox.js"
import type { SessionResult } from "./ase-test-session.js"
import { llmTextFrom }        from "./ase-test-llm.js"

/*  the maximum number of characters of a judged text  */
const TEXT_MAX = 40000

/*  the first balanced JSON object of a judge response carrying a valid score, as a
    judge may wrap its answer into prose or a code fence, or mention braces in it  */
export const judgeParse = (text: string): { score: number, reason: string } | null => {
    for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
        let depth = 0
        let quoted = false
        for (let i = start; i < text.length; i++) {
            const c = text[i]
            if (quoted) {
                if (c === "\\")
                    i++
                else if (c === "\"")
                    quoted = false
            }
            else if (c === "\"")
                quoted = true
            else if (c === "{")
                depth++
            else if (c === "}" && --depth === 0) {
                try {
                    const json = JSON.parse(text.slice(start, i + 1))
                    if (typeof json.score === "number" && json.score >= 0 && json.score <= 1)
                        return { score: json.score, reason: typeof json.reason === "string" ? json.reason : "" }
                }
                catch (_err) {
                    /*  no JSON object: try the next opening brace  */
                }
                break
            }
        }
    }
    return null
}

/*  a judge whose votes stayed mostly unparsable, carrying the raw vote texts  */
export class JudgeMalfunction extends Error {
    constructor (message: string, public log: string) {
        super(message)
    }
}

/*  the shared vote loop of the LLM judges: each of the <votes> independent votes
    scores from 0.0 to 1.0 as a JSON object (an unparsable answer is re-asked twice),
    a vote passes when its score reaches the threshold, and the majority of the
    parsed votes decides, while a majority of still unparsable votes signals a
    malfunctioning judge, which is thrown (an evaluation error, retried on the kept
    sandbox) instead of being reported as a quality failure  */
const judgeVotes = async (sandbox: Sandbox, system: string, prompt: string,
    threshold: number, votes: number, kind: string):
Promise<{ kind: string, pass: boolean, detail: string, scores?: number[], log?: string }> => {
    const model  = process.env.ASE_TEST_JUDGE_MODEL ?? "claude-haiku-5-5"
    const scores: { score: number, reason: string, model: string }[] = []
    const raw:    string[] = []
    let unparsable = 0
    for (let vote = 0; vote < votes; vote++) {
        let parsed: { score: number, reason: string } | null = null
        for (let ask = 1; parsed === null && ask <= 3; ask++) {
            const answer = await llmTextFrom(sandbox, model, system, prompt)
            raw.push(`--- vote ${vote + 1}, ask ${ask} (model: ${answer.model})\n${answer.text.slice(0, 2048)}`)
            parsed = judgeParse(answer.text)
            if (parsed !== null)
                scores.push({ ...parsed, model: answer.model })
        }
        if (parsed === null)
            unparsable++
    }
    const log = raw.join("\n") + "\n"
    if (unparsable > votes / 2)
        throw new JudgeMalfunction(`judge malfunctioned: ${unparsable}/${votes} votes unparsable (model: ${model})`, log)
    const models = [ ...new Set(scores.map((entry) => entry.model)) ]
        .map((name) => `${name} ×${scores.filter((entry) => entry.model === name).length}`).join(", ")
    const passed = scores.filter((entry) => entry.score >= threshold).length
    const pass   = passed > scores.length / 2
    return {
        kind, pass, scores: scores.map((entry) => entry.score), log,
        detail: `${passed}/${scores.length} votes >= ${threshold} ` +
            (unparsable > 0 ? `(${unparsable} unparsable) ` : "") +
            `(scores: ${scores.map((entry) => entry.score.toFixed(2)).join(", ")}; model: ${models}; ` +
            `${scores.map((entry) => entry.reason).filter((reason) => reason !== "").at(-1) ?? ""})`
    }
}

/*  the changed files of a unified diff with their added and removed line counts  */
const diffStat = (diff: string): string => {
    const files: { name: string, added: number, removed: number }[] = []
    for (const line of diff.split("\n")) {
        const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
        if (header !== null)
            files.push({ name: header[2], added: 0, removed: 0 })
        else if (files.length > 0 && line.startsWith("+") && !line.startsWith("+++"))
            files[files.length - 1].added += 1
        else if (files.length > 0 && line.startsWith("-") && !line.startsWith("---"))
            files[files.length - 1].removed += 1
    }
    return files.length === 0 ? "(no files changed)" :
        files.slice(0, 50).map((file) => `- \`${file.name}\`: +${file.added} / -${file.removed} lines`).join("\n")
}

/*  judge the output of one run against a rubric, optionally with the changed files
    of the session as ground truth (the reply alone need not narrate a file change)  */
export const judgeRubric = async (sandbox: Sandbox, result: SessionResult,
    spec: { file: string, threshold: number, votes: number, evidence: "none" | "diffstat" }, diff = ""):
Promise<{ kind: string, pass: boolean, detail: string, scores?: number[], log?: string }> => {
    const rubric = fs.readFileSync(spec.file, "utf8")
    const output = result.output.join("\n").slice(0, TEXT_MAX)
    const system =
        "You are a strict, impartial evaluator of the output of an AI coding assistant skill.\n" +
        "Score how well the output satisfies the rubric, from 0.0 (not at all) to 1.0 (fully).\n" +
        (spec.evidence === "diffstat" ? "The section \"Files Changed by the Session\" is ground truth " +
            "measured by the test harness, not part of the output.\n" : "") +
        "Respond with a single JSON object of the form { \"score\": <number>, \"reason\": \"<one sentence>\" } " +
        "only, without using any tools."
    const prompt = `# Rubric\n\n${rubric}\n\n# Output Under Evaluation\n\n${output}` +
        (spec.evidence === "diffstat" ? `\n\n# Files Changed by the Session\n\n${diffStat(diff)}` : "")
    return judgeVotes(sandbox, system, prompt, spec.threshold, spec.votes, "rubric")
}

/*  judge the semantic similarity of the actual text of one run against the golden
    expected text: shared decisions, facts, and constraints count, while wording,
    structure, ordering, and extra elaboration do not  */
export const judgeSimilar = async (sandbox: Sandbox,
    expectedText: string, actualText: string,
    spec: { threshold: number, votes: number }):
Promise<{ kind: string, pass: boolean, detail: string, scores?: number[], log?: string }> => {
    const system =
        "You are a strict, impartial evaluator of the semantic similarity of two texts: " +
        "the EXPECTED text states the decisions, facts, and constraints a result must carry, " +
        "and the ACTUAL text is the result under evaluation.\n" +
        "Score from 0.0 (semantically unrelated or contradicting) to 1.0 (semantically equivalent): " +
        "count only whether the ACTUAL text commits to the same decisions, facts, and constraints " +
        "as the EXPECTED text; ignore wording, structure, ordering, formatting, and extra elaboration " +
        "which contradicts nothing; lower the score for every contradicted or missing commitment.\n" +
        "Respond with a single JSON object of the form { \"score\": <number>, \"reason\": \"<one sentence>\" } " +
        "only, without using any tools."
    const prompt =
        `# EXPECTED\n\n${expectedText.slice(0, TEXT_MAX)}\n\n` +
        `# ACTUAL\n\n${actualText.slice(0, TEXT_MAX)}`
    return judgeVotes(sandbox, system, prompt, spec.threshold, spec.votes, "similar")
}
