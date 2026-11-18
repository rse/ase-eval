#!/usr/bin/env bash
##
##  clean-sandboxes.sh -- remove the leftover sandboxes of killed harness
##  runs: stop the "ase service" of every "/tmp/ase-test-*" sandbox, kill
##  any service process still running in one, and remove the sandboxes,
##  sparing sandboxes younger than one minute (live runs)
##
##  Usage: etc/clean-sandboxes.sh [--dry-run]
##

set -uo pipefail

dry=""
[[ "${1:-}" == "--dry-run" ]] && dry="yes"
tmp="${TMPDIR:-/tmp}"
tmp="${tmp%/}"

#   the sandboxes older than one minute
mapfile -t dirs < <(find "$tmp" -maxdepth 1 -type d -name 'ase-test-*' -mmin +1 2>/dev/null)

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
