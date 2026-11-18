#!/usr/bin/env bash
##
##  generate_comparison.sh -- compare the summaries of past test harness
##  runs: print the cases/groups x models matrices and the runs-over-time
##  table, and write COMPARISON.md and COMPARISON.html into results/
##  (free -- it only reads the stored summary.json files under results/)
##
##  Usage: ./generate_comparison.sh [--add=<dir> ...] [--results=<dir>] [--out=<dir>]
##  (an explicit --out overrides the default output directory results/)
##

set -euo pipefail

#   operate from the directory of this script (the harness directory)
cd "$(dirname "$0")"

#   run the comparison into results/ by default (a later --out option of
#   the passed-through options wins), passing through any harness options
exec node --import tsx src/ase-test-compare.ts --out=results "$@"
