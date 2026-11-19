set -euo pipefail
#   the full SpecBook skeleton next to the imported artifact files
ase spec init --fetch never > /dev/null 2>&1 || true
git add --all
GIT_AUTHOR_DATE="2026-05-04T09:00:00Z" GIT_COMMITTER_DATE="2026-05-04T09:00:00Z" git commit -q --no-verify -m "Specification of the room booking service"
git tag ase-test-base
