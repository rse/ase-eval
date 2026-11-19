source "$CASE_DIR/../_base/init.sh"
git tag ase-test-base
#   a staged "API cleanup": tax() now takes the rate as a fraction (0.2) like
#   the new pricing service, documented in the README -- but its callers
#   grand_total() and render() (and the CLI default of 20) still pass percents
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''def tax(amount, rate):
    """Tax for an amount at a percentage rate, rounded to cents."""
    value = Decimal(amount) * Decimal(str(rate)) / Decimal(100)''', '''def tax(amount, rate):
    """Tax for an amount at a rate given as a fraction (e.g. 0.2), rounded to cents."""
    value = Decimal(amount) * Decimal(str(rate))''')
open(p, "w").write(s)
p = "README.md"
s = open(p).read() + "\nAll tax rates are given as fractions, e.g. `tax(amount, 0.2)` for 20 percent.\n"
open(p, "w").write(s)
PY
git add --all
