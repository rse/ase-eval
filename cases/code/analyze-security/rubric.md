# Rubric: Security Analysis of a Small Notes Service

The Node.js notes service contains three seeded security problems:
(1) `src/db.js` `findNotesByOwner()` concatenates `owner` and `search` into
SQL (SQL injection; the client supports parameters, as `deleteNote()` shows);
(2) `src/files.js` joins the user-supplied `name` into the upload path
without normalization or containment check (path traversal, e.g.
`../../etc/passwd`); (3) `src/config.js` hard-codes a live mail API key.
The `x-user` header as the only authentication is a further, secondary
problem. Score each criterion and average them:

1.  **Recall**: all three seeded problems are reported.
2.  **Precision of location**: each finding cites the right file (and
    function or line).
3.  **Explanation**: each finding explains the attack or impact concretely.
4.  **Remedy**: sensible fixes (parameterized queries, resolve plus prefix
    check or `path.basename`, secret from the environment/secret store and
    key rotation).
5.  **Signal**: no flood of irrelevant or wrong findings; severities are
    plausible (the injection and the traversal high).
