#   shared fixture helper of the repo/* cases (sourced by their setup scripts):
#   copy the invoice project into the (already initialized) Git repository and
#   commit it as the initial version, with deterministic dates
set -euo pipefail
cp -R "$(dirname "${BASH_SOURCE[0]}")/tree/." .
commit () {
    local message="$1" date="$2"
    git add --all
    GIT_AUTHOR_DATE="$date" GIT_COMMITTER_DATE="$date" git commit -q --no-verify -m "$message"
}
commit "Initial version of the invoice library" "2026-05-04T09:00:00Z"
