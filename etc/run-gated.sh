##
##  run-gated.sh -- sourced by "run_all_tests.sh" and "run_all_tests_local.sh":
##  run the harness, and when ALL cases are selected, first run the cheap
##  probe cases ("probe/*") and only on their success the remaining cases
##
##  Usage: runGated <prefix-option-or-empty> [harness options...]
##
##  A case selection (globs, "-c"/"--cases", "-l"/"--list", "-d"/"--describe")
##  or the option "--no-probe-gate" runs the harness once, without the gate.
##

runGated () {
    local prefix="$1"
    shift
    local harness=( node --import tsx src/ase-test.ts )
    [[ -n "$prefix" ]] && harness+=( "$prefix" )

    #   scan the harness options: strip "--no-probe-gate" and "-r/--results",
    #   and detect a case selection (values of value options are no globs)
    local gate=1 selected=0 results="" rc=0
    local args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --no-probe-gate )                     gate=0 ;;
            -r | --results )                      results="${2:?$1 needs a directory}"; shift ;;
            --results=* )                         results="${1#--results=}" ;;
            -j | --jobs | -m | --max-cost-usd | --llm )
                                                  args+=( "$1" "${2:?$1 needs a value}" ); shift ;;
            -c | --cases | --cases=* | -l | --list | -d | --describe )
                                                  selected=1; args+=( "$1" ) ;;
            -* )                                  args+=( "$1" ) ;;
            * )                                   selected=1; args+=( "$1" ) ;;
        esac
        shift
    done

    #   without the gate, run the harness once
    if [[ $gate -eq 0 || $selected -eq 1 ]]; then
        [[ -n "$results" ]] && args+=( "--results=$results" )
        "${harness[@]}" ${args[@]+"${args[@]}"}
        return $?
    fi

    #   phase 1: the probe cases
    echo "phase 1/2: probe cases (probe/*)"
    "${harness[@]}" ${args[@]+"${args[@]}"} ${results:+"--results=$results/probe"} --cases='probe/*' || rc=$?
    if [[ $rc -ne 0 ]]; then
        echo "probe cases failed (exit code $rc) -- skipping the remaining cases"
        return $rc
    fi

    #   phase 2: all remaining cases
    echo ""
    echo "phase 2/2: remaining cases"
    "${harness[@]}" ${args[@]+"${args[@]}"} ${results:+"--results=$results/suite"} --cases='!probe/*'
    return $?
}
