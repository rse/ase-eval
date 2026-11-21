#   the first mention of each skill in the generated workflow (its "<flow>" part,
#   as the getopt "<expand>" body above may echo the whole prompt on one line)
#   follows the requested order, and the middle steps are marked as concurrent
f="$1"
body=$(sed -n '/<flow>/,$p' "$f")
[ -n "$body" ] || body=$(cat "$f")
line () { printf '%s\n' "$body" | grep -n -m1 -- "$1" | cut -d: -f1; }
l=$(line ase-code-lint); c=$(line ase-repo-changelog); d=$(line ase-repo-diff); m=$(line ase-repo-commit)
[ -n "$l" ] && [ -n "$c" ] && [ -n "$d" ] && [ -n "$m" ] || { echo "a skill is missing"; exit 1; }
[ "$l" != "$c" ] && [ "$l" != "$d" ] && [ "$c" != "$m" ] && [ "$d" != "$m" ] || { echo "same line: lint=$l changelog=$c diff=$d commit=$m"; exit 1; }
[ "$l" -lt "$c" ] && [ "$l" -lt "$d" ] && [ "$c" -lt "$m" ] && [ "$d" -lt "$m" ] || { echo "wrong order: lint=$l changelog=$c diff=$d commit=$m"; exit 1; }
grep -Eqi 'parallel|concurrent|simultaneous' "$f" || { echo "no concurrency"; exit 1; }
