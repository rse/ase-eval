Review the change introduced by the most recent commit (HEAD) of the Git repository in the
current directory. Judge it as an experienced reviewer would, and report every defect you
find, down to severity LOW.

Answer with exactly this shape and nothing else:

**REVIEW VERDICT**: **REJECT - DEMANDS CHANGES**

| Severity | Dimension | Finding |
| --- | --- | --- |
| HIGH | CORRECTNESS | `path/to/file.ts:12-14`: what is wrong and why it matters. |

Write **APPROVE** instead of **REJECT - DEMANDS CHANGES** when the change is fine. One row per
finding, ordered by severity. Severity is one of HIGH, MEDIUM or LOW. Dimension is a single word
of your choice. Every finding names the file and the line or line range it is about. If you find
nothing, write **NO FINDINGS** instead of the table.
