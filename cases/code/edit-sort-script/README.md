code/edit-sort-script
=====================

`ase-code-edit <request for sort.py>`, 2 runs, at least 1 must pass, budget $2.50 per run.

## Objective

Checks that `ase-code-edit` writes working code from a single request,
with no user interaction. The request asks for a Python script `sort.py`
that reads integers from stdin and prints them in descending order. The
script must not use any library sorting (no `import`, no `sorted()`, no
`list.sort()`). The case runs the generated script and compares its
output with the reference `oracle.py`. It also checks the constraint
and which files changed.

## Failures Uncovered

-   **Skill aborts, times out, or exceeds its budget**: caught by
    `notErrored`.
-   **No file written, or written under the wrong name**: caught by
    `fileExists: sort.py`.
-   **Constraint ignored** (an `import`, `sorted(`, or `.sort(`): caught
    by `regex` on the file with `not`.
-   **Wrong behavior**, such as ascending order, mishandled duplicates or
    negative numbers, or a crash on empty input: caught by `exec`, which
    compares the output of `python3 sort.py` with `python3 oracle.py` for
    4 stdin vectors (`3 1 2`, `10 -5 10 0`, `7`, and empty).
-   **Extra or stray files** (scratch files, tests, configuration):
    caught by `gitDiff` with `changed: [ sort.py ]`.

## Artifacts

Each `results/<timestamp>/code/edit-sort-script/run-<n>/` contains:

-   `transcript.md`, `transcript.jsonl`: the EDIT TODO box, the tool
    calls, and the verification
-   `diff.patch`: the changes to the project (the new `sort.py`)
-   `files/sort.py`: the generated script
-   `result.json`: the outcome of each oracle, including the vector count
    of `exec`

The general artifact table is in [`TESTS.md`](../../../TESTS.md#artifacts).

## Example Run

```
npm start test -- -K --cases=code/edit-sort-script
```

Input: an empty Git sandbox and the request from `case.yaml` as the skill
argument. Excerpt from
`results/2026-11-16T07-37-07/code/edit-sort-script/run-1/`
(`claude-opus-5-5`, 2/2 runs passed). First `transcript.md`:

```
**HOW**:  Python script `sort.py`; no library functions at all (no `import`, no `sorted()`, no `list.sort()`); [...]
**TOOL** `Write`: {"file_path":"/tmp/ase-test-code-edit-sort-script-r1-WFoh0w/project/sort.py", [...]}
⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ status: **changes applied**
⧉ **ASE**: ✪ skill: **ase-code-edit**, ▶ status: **verification passed**
**RESULT**: success (turns: 5, cost: $0.8156)
```

Then `diff.patch`, which shows the model's own inline merge sort:

```
+#  sort in descending order via iterative (bottom-up) merge sort:
+#  merge adjacent runs of doubling width, always taking the larger head element first
+n      = len(numbers)
+buffer = [ 0 ] * n
```

Oracle results from `result.json`:

```
{"kind": "notErrored", "pass": true, "detail": "no error"}
{"kind": "fileExists", "pass": true, "detail": "all files exist"}
{"kind": "regex",      "pass": true, "detail": "all patterns satisfied"}
{"kind": "exec",       "pass": true, "detail": "4/4 vectors match"}
{"kind": "gitDiff",    "pass": true, "detail": "diff touches [ sort.py ]"}
```
