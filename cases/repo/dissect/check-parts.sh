#   each of the three concerns lands in exactly one part worktree, and the
#   original working copy keeps its (uncommitted) change set untouched
set -u
wts=$(git worktree list --porcelain | awk '/^worktree /{print $2}' | tail -n +2)
n=$(echo "$wts" | grep -c .)
[ "$n" -ge 2 ] && [ "$n" -le 3 ] || { echo "expected 2-3 part worktrees, got $n"; exit 1; }
for pat in 'currency=' '## Usage' 'VERSION'; do
    k=0
    for w in $wts; do
        git -C "$w" diff HEAD | grep -E '^\+' | grep -qF -- "$pat" && k=$((k+1))
    done
    [ "$k" -eq 1 ] || { echo "concern '$pat' found in $k worktrees"; exit 1; }
done
git diff | grep -qF 'currency=' && git diff | grep -qF '## Usage' && git diff | grep -qF 'VERSION' \
    || { echo "original working copy lost its change set"; exit 1; }
