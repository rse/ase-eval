#!/usr/bin/env bash
##
##  launch_tests.sh -- interactive test launcher: pick the test cases
##  (first entry selects all) and the models (from the live model listing
##  of the agent tool), then run every selected case with every selected
##  model -- one parallel runner per model, each into its own
##  results/<timestamp>-<model>/ directory -- with live progress, and
##  finally refresh COMPARISON.md and COMPARISON.html
##
##  Usage: ./launch_tests.sh [harness options, e.g. --jobs=6 -K --max-cost-usd=50]
##

set -euo pipefail

#   operate from the directory of this script (the harness directory)
cd "$(dirname "$0")"

#   run the launcher, passing through any harness options to every runner
exec node --import tsx src/ase-test-launch.ts "$@"
