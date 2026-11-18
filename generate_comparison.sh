#!/usr/bin/env bash
##
##  generate_comparison.sh -- compare the summaries of past test harness
##  runs: print the cases/groups x models matrices and the runs-over-time
##  table, and write COMPARISON.md and COMPARISON.html into the repo root
##  (free -- it only reads the stored summary.json files under results/)
##
##  Usage: ./generate_comparison.sh [--add=<dir> ...] [--results=<dir>] [--out=<dir>]
##

set -euo pipefail

#   operate from the directory of this script (the harness directory)
cd "$(dirname "$0")"

#   run the comparison, passing through any harness options
exec node --import tsx src/ase-test-compare.ts "$@"
