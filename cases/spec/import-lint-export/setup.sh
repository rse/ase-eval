set -euo pipefail
#   an initialized but empty SpecBook specification (the standard schema)
ase spec init --fetch never > /dev/null 2>&1 || ase spec init > /dev/null 2>&1
git add --all
GIT_AUTHOR_DATE="2026-05-04T09:00:00Z" GIT_COMMITTER_DATE="2026-05-04T09:00:00Z" git commit -q --no-verify -m "Initialize the specification"
git tag ase-test-base
