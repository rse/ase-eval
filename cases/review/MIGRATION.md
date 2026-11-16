# Migration of the `ase-repo-review` benchmark into the skill harness

## Origin

The review benchmark comes from the ASE repository
(`github.com/rse/ase`), directory `benchmark/repo-review/`. The last commit
there touching it is `d7541775` (2026-11-04, "Benchmark: revised test cases
correctness-cents and security-refunds, measure.mjs"). The copy migrated here
was taken from the local working copy of ASE at `19b6f27a`. That copy also
held changes not committed in ASE: the case `context-returns` and the
modified `MEASUREMENTS.md`. The approach follows the effectiveness test of
MERIT (see `docs/review/README.md`, "Origin").

## New layout

| Former (`benchmark/repo-review/`) | Now |
|---|---|
| `cases/<name>/` | `cases/review/<name>/` |
| `lib/*.mjs` | `src/review/lib/` |
| `run`, `measure`, `compare`, `check`, `prove`, `selftest`, `check-language` (`.mjs`) | `src/review/` |
| `testdata/` (shared canned transcripts, pilot runs) | `src/review/testdata/` |
| `README.md`, `DESIGN.md`, `MEASUREMENTS.md`, `assets/` | `docs/review/` |
| `cases/<name>/results/` | `results/review/<name>/` (not versioned) |
| `.gitattributes` (LF for fixtures) | root `.gitattributes` |

## Changes

- **Harness integration**: each case got a `case.yaml` and runs as harness
  case `review/<name>`; for this, the harness gained `fixture.change`,
  `disallowedTools`, and the `review` oracle (`src/ase-test-review.ts`), whose
  contract is in the harness `TESTS.md`. The change commit is built as in
  `src/review/lib/copy.mjs`.
- **Paths**: `src/review/lib/common.mjs` is the only place that knows the paths.
  - case names come from the directories in `cases/review/`
  - the change commit message comes from each `case.yaml` (the hard-coded
    case table is gone)
- **Commit checks**: the thresholds, the scoring code and the log are checked
  against the Git repository of the harness, not the ASE repository. `REPO_DIR`
  (ASE) is used only for `plugin/` and `tool/`.
- **Contamination check**: flags any tool call that touches `cases/review/`
  or `src/review/` (or a `solution/` folder), instead of
  `benchmark/repo-review`.
- **Tools**:
  - `measure.mjs` appends its log entries to `docs/review/MEASUREMENTS.md`
  - `check-language.mjs` scans `src/review/`, `cases/review/` and
    `docs/review/`
  - three path checks in `selftest.mjs` now expect `cases/review/`
- **Shortcuts**: `npm start review-selftest`, `npm start review-check-language`.
- **Docs**:
  - `docs/review/` updated to the new paths
  - `MEASUREMENTS.md` keeps its entries unchanged (never rewritten), plus a
    dated note about the move

Unchanged: fixtures, expected-results lists, thresholds, proofs, reference
runs, scoring rules. Self-test (177/177), list checks, proofs and the dry-run
figures are the same as before the migration.
