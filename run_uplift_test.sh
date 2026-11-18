#!/usr/bin/env bash
##
##  run_uplift_test.sh -- run the ASE uplift benchmark: the two plain-Claude
##  baseline arms of uplift/ (one-shot and plan-mode) plus the ASE arm
##  "flow/csvq-grill" of the regular cases, under the same conditions, and
##  print the comparison table (see "uplift/README.md")
##
##  Usage: ./run_uplift_test.sh [--force-model <model>] [harness options, e.g. --jobs=3]
##
##  A failing baseline arm is an expected *result* of the benchmark, so the
##  exit code is the one of the ASE arm (the regression), except that an
##  infrastructure error resp. cost-ceiling stop (exit code 2) of the
##  baselines is propagated.
##

set -euo pipefail

#   operate from the directory of this script (the harness directory)
cd "$(dirname "$0")"

#   take option "--force-model" out of the passed-through harness options
forceModel=""
args=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --force-model )   forceModel="${2:?--force-model needs a model name}"; shift 2; continue ;;
        --force-model=* ) forceModel="${1#--force-model=}"; shift; continue ;;
    esac
    args+=("$1")
    shift
done
set -- ${args[@]+"${args[@]}"}

#   force all models onto the given one
if [[ -n "$forceModel" ]]; then
    for var in ASE_TEST_SIM_FORCE ASE_TEST_MODEL ASE_TEST_JUDGE_MODEL ASE_TEST_SIM_MODEL \
        ANTHROPIC_MODEL ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL; do
        export "$var=$forceModel"
    done
    echo "forcing all models to: $forceModel"
fi

#   warn about the costs and ask for confirmation
cat <<'EOF'
This runs the ASE uplift benchmark: the same vague CSV-tool request is
solved by plain one-shot Claude Code, by Claude Code plan mode, and by
the ASE workflow (edit, grill, implement), each judged black-box by the
same hidden oracles, followed by a comparison of pass rate, hidden suite
tests, cost, and duration.

WARNING: the benchmark runs real agent sessions against the Anthropic
API (or the configured gateway), roughly $15-25 for its 6 runs. The
baseline arms are *expected* to fail -- that is the measurement.

EOF
read -r -p "Run the uplift benchmark now? [y/N] " answer
if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "aborted -- no tests were run"
    exit 0
fi

#   one results base, so all arms run under the same conditions and the
#   comparison references one invocation
results="results/uplift-$(date -u +%Y-%m-%dT%H-%M-%S)"
harness=( node --import tsx src/ase-test.ts )

#   phase 1: the plain-Claude baseline arms (an exit code 1 is an expected
#   benchmark result and must not stop the ASE arm)
echo "phase 1/3: baseline arms (uplift: one-shot, plan-mode)"
rcBase=0
"${harness[@]}" --cases-dir uplift --results "$results/baseline" "$@" || rcBase=$?
if [[ $rcBase -ge 2 ]]; then
    echo "baseline arms stopped with an infrastructure error (exit code $rcBase) -- aborting"
    exit $rcBase
fi

#   phase 2: the ASE arm (the regular regression case)
echo ""
echo "phase 2/3: ASE arm (cases: flow/csvq-grill)"
rcAse=0
"${harness[@]}" --cases flow/csvq-grill --results "$results/ase" "$@" || rcAse=$?

#   phase 3: the comparison table
echo ""
echo "phase 3/3: comparison"
node --import tsx uplift/compare.mts "$results"
exit $rcAse
