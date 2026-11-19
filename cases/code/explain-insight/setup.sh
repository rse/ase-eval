set -euo pipefail
cp -R "$CASE_DIR/../../repo/_base/tree/." .
c () { git add --all; GIT_AUTHOR_NAME="$3" GIT_AUTHOR_EMAIL="$4" GIT_AUTHOR_DATE="$2" GIT_COMMITTER_DATE="$2" git commit -q --no-verify -m "$1"; }
c "Initial version of the invoice library" "2026-03-01T09:00:00Z" "Dana Developer" "dana@example.com"
sed -i 's/rate = 20/rate = 20.0/' invoice/cli.py
c "Use a float default tax rate" "2026-03-10T09:00:00Z" "Sam Smith" "sam@example.com"
printf '\n## Testing\n\nRun `python3 -m unittest`.\n' >> README.md
c "Document testing" "2026-04-02T09:00:00Z" "Dana Developer" "dana@example.com"
sed -i 's/"Sum of all line totals/"Sum of the line totals/' invoice/calc.py
c "Wording" "2026-04-20T09:00:00Z" "Dana Developer" "dana@example.com"
git tag ase-test-base
