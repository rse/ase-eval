#!/usr/bin/env bash
##
##  clean-sandboxes.sh -- remove the leftover sandboxes of killed harness
##  runs: stop the "ase service" of every "/tmp/ase-test-*" sandbox, kill
##  any service process still running in one, and remove the sandboxes,
##  sparing sandboxes younger than one minute (live runs)
##
##  Usage: etc/clean-sandboxes.sh [--dry-run] [--auto]
##
##  With "--auto" (as called by the run scripts), nothing is cleaned while
##  another harness run is live, and the sandboxes kept on purpose ("-k"/"-K",
##  marked by a ".keep" file) are spared, too.
##

set -uo pipefail

dry=""
auto=""
for arg in "$@"; do
    case "$arg" in
        --dry-run ) dry="yes" ;;
        --auto )    auto="yes" ;;
    esac
done
tmp="${TMPDIR:-/tmp}"
tmp="${tmp%/}"

#   in automatic mode, never touch the sandboxes of a live harness run
if [[ -n "$auto" ]]; then
    for lock in "$(dirname "$0")"/../results/.running-*; do
        [[ -e "$lock" ]] || continue
        pid="${lock##*-}"
        if kill -0 "$pid" 2>/dev/null; then
            echo "sandbox cleanup skipped: harness run (pid $pid) is live"
            exit 0
        fi
    done
fi

#   the sandboxes older than one minute (in automatic mode without the kept ones)
mapfile -t dirs < <(find "$tmp" -maxdepth 1 -type d -name 'ase-test-*' -mmin +1 2>/dev/null |
    while read -r dir; do
        [[ -n "$auto" && -e "$dir/.keep" ]] && continue
        echo "$dir"
    done)
[[ -n "$auto" && ${#dirs[@]} -eq 0 ]] && exit 0

#   stop their services the regular way first
for dir in "${dirs[@]}"; do
    if [[ -d "$dir/project" ]]; then
        echo "stop service: $dir/project"
        [[ -z "$dry" ]] && (cd "$dir/project" && HOME="$dir/home" timeout 30 ase service stop >/dev/null 2>&1)
    fi
done

#   kill any "ase service" process whose working directory lies in such a sandbox
for pid in $(pgrep -f "ase.js service start" 2>/dev/null); do
    cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null || true)"
    for dir in "${dirs[@]}"; do
        if [[ -n "$cwd" && "$cwd" == "$dir"* ]]; then
            echo "kill service: pid $pid ($cwd)"
            [[ -z "$dry" ]] && kill "$pid" 2>/dev/null
        fi
    done
done

#   remove the sandboxes
for dir in "${dirs[@]}"; do
    echo "remove: $dir"
    [[ -z "$dry" ]] && rm -rf "$dir"
done
echo "${#dirs[@]} sandbox(es) ${dry:+would be }cleaned"
