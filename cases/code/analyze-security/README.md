# code/analyze-security

`ase-code-analyze --security src/` on a small Node.js notes service with
three seeded vulnerabilities (SQL injection in `db.js`, path traversal in
`files.js`, a hard-coded live API key in `config.js`). Read-only: the diff
must stay empty. Regex checks each file and issue class; a rubric checks
recall, locations, explanations, and remedies.
