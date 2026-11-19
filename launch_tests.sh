#!/usr/bin/env bash
##
##  launch_tests.sh -- interactive test launcher: pick the test cases
##  (first entry selects all) and the models (from the live model listing
##  of the agent tool), then run every selected case with every selected
##  model -- one parallel runner per model, each into its own
##  results/<timestamp>-<model>/ directory -- with live progress, and
##  finally refresh results/COMPARISON.md and results/COMPARISON.html
##
##  Usage: ./launch_tests.sh [launcher options] [harness options]
##
##  Launcher options (each one given skips its interactive step):
##    --tests <globs>    comma-separated case globs, e.g. --tests probe/help,meta/*
##    --models <ids>     comma-separated model ids to force, e.g. --models claude-haiku-5-5
##    --ref-model <id>   fixed judge and simulator model of all runners
##                       (default: $ASE_TEST_REF_MODEL, else eu.anthropic.claude-opus-5-5)
##    --ref-fallback <id> judge and simulator model after a safeguard refusal
##                       (default: $ASE_TEST_REF_FALLBACK, else eu.anthropic.claude-sonnet-5)
##    -F, --only-failed  skip, per model, the cases it passed 100% in its last two
##                       executions under results/ (--no-only-failed: off; default:
##                       a pre-checked option in an interactive session, off with --yes)
##    --yes              skip the cost confirmation
##  Harness options are passed to every runner, e.g. --jobs=6 -K --max-cost-usd=50.
##  After a run, a "repeat:" line shows the command that repeats the exact run.
##

set -euo pipefail

#   operate from the directory of this script (the harness directory)
cd "$(dirname "$0")"

#   run the launcher, passing through any harness options to every runner
exec node --import tsx src/ase-test-launch.ts "$@"
