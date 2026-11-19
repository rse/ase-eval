#   the first mention of each skill in the generated workflow follows the
#   requested order, and the middle steps are marked as concurrent
f="$1"
line () { grep -n -m1 -- "$1" "$f" | cut -d: -f1; }
l=$(line ase-code-lint); c=$(line ase-repo-changelog); d=$(line ase-repo-diff); m=$(line ase-repo-commit)
[ -n "$l" ] && [ -n "$c" ] && [ -n "$d" ] && [ -n "$m" ] || { echo "a skill is missing"; exit 1; }
[ "$l" -lt "$c" ] && [ "$l" -lt "$d" ] && [ "$c" -lt "$m" ] && [ "$d" -lt "$m" ] || { echo "wrong order: lint=$l changelog=$c diff=$d commit=$m"; exit 1; }
grep -Eqi 'parallel|concurrent|simultaneous' "$f" || { echo "no concurrency"; exit 1; }
