meta/brainstorm-headless
========================

`ase-meta-brainstorm --max-clarify 0 --min-ideas 8 --max-shortlist 3 <topic>`, 3 runs, at least 2 must pass, budget $2.50 per run.

## Objective

Checks that `ase-meta-brainstorm` runs a complete session without user
interaction. The topic is "a command-line tool which reminds developers
of stale local Git branches". With `--max-clarify 0`, the skill asks no
clarifying questions. The session must go through all phases: generate
ideas, cluster and score them, pick a shortlist, and give a
recommendation. An LLM judge grades the quality of the output against
`rubric.md`.

## Failures Uncovered

-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.
-   **Session stops before the final phase**, for example while waiting
    for an answer although `--max-clarify 0` is set: caught by `regex` on
    `RECOMMENDED IDEA|RECOMMENDATION`.
-   **Option values ignored**, such as fewer than 8 ideas or more than 3
    shortlisted: caught by the `rubric` judge (criteria "Divergence" and
    "Shortlist").
-   **No real clustering, scoring, or pruning, or ideas off-topic**:
    caught by the `rubric` judge (criteria "Convergence" and
    "Topicality").
-   **Recommendation without a rationale**: caught by the `rubric` judge
    (criterion "Recommendation").

The `rubric` oracle passes when all 3 judge votes score at least 0.7.

## Artifacts

Each `results/<timestamp>/meta/brainstorm-headless/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the ideas, clusters, scores,
    distilled ideas, and recommendation
-   `result.json`: the outcome of each oracle, including the 3 judge
    `scores` and the judge's reasoning in the `rubric` result

The case writes no project files. The general artifact table is in
[`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=meta/brainstorm-headless
```

Input: an empty sandbox and the topic as a free-text argument. Excerpt
from `results/2026-11-16T07-37-07/meta/brainstorm-headless/run-1/transcript.md`
(`claude-opus-5-5`, 3/3 runs passed; long lines are truncated):

```
⧉ **ASE**: ✪ skill: **ase-meta-brainstorm**, ▶ options: maxClarify: **0**, minIdeas: **8**, minRank: **7**, maxShortlist: **3**
🔵 **IDEA 1**: **`git stale` Subcommand**: Ship a `git-stale` executable on `PATH` [...]
🔵 **IDEA 2**: **Checkout Hook Nudge**: Use a `post-checkout` hook to print a one-line reminder [...]
[... ideas 3-12 ...]
⚪ **IDEA CLUSTER 1/3**: Stale Detection Core - [...] **IDEAS**: 1, 5, 6, 10, 12
- **Pruned (YAGNI)**: Ideas 7 (Multi-Repo Sweep) and 9 (Forge PR Status) go beyond "local Git branches" [...]
- **Scores**: 1 → 9, 2 → 8, 4 → 8, 5 → 8, 3 → 7, 6 → 7, 10 → 7, 11 → 7, 12 → 6, 8 → 5.
🔵 **DISTILLED IDEA**: **`git stale` Subcommand** (rank: 9/10, cluster: Stale Detection Core): [...]
🟠 **RECOMMENDED IDEA**: Build the `git stale` subcommand [...] as the core, add the once-per-day `post-checkout` nudge [...]
**RESULT**: success (turns: 4, cost: $0.4641)
```

Oracle results from `result.json` (the judge reasoning is shortened):

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
{"kind": "rubric",     "pass": true, "scores": [0.9, 0.8, 0.9],
 "detail": "3/3 votes >= 0.7 (scores: 0.90, 0.80, 0.90; The output generates 12 visibly
            distinct ideas, clusters them into three themes [...] The main weakness is that
            the recommendation is a composite of two ideas with only a brief rationale [...])"}
```
