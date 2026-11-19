# Rubric: Discovering a Retry/Backoff Library for a Node.js Project

The project is an ESM Node.js (>= 22) webhook relay using the global
`fetch`. The skill was to discover at most 6 third-party npm packages for
retrying failed HTTP requests with exponential backoff and jitter. Its
output contract is a *component hints* table (a USP, crux, or gotcha per
component) and a *component ranking* table with registry facts (version,
downloads, stars, update and creation dates, dependencies); picking one is
left to `ase-meta-evaluate`. Score each criterion and average them:

1.  **Relevance**: all candidates are real npm packages that fit the need
    (retries with backoff for `fetch`-based HTTP, e.g. `ky`, `p-retry`,
    `exponential-backoff`, `undici`'s `RetryAgent`, `cockatiel`,
    `fetch-retry`); none is invented or off-topic.
2.  **Hints**: each hint is specific and correct for the use case (built-in
    retry, jitter support, `fetch` compatibility, gotchas).
3.  **Facts**: the ranking shows registry facts per package that look
    plausible (current major versions, recent update dates); unavailable
    values are marked as such instead of being guessed.
4.  **Ranking**: the order is plausible (well-maintained, focused,
    widely-used packages first; stale or heavy ones lower or flagged).
5.  **Form**: both tables are complete and readable; nothing in the
    project was changed.
