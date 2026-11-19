source "$CASE_DIR/../_base/init.sh"
c () { git add --all; GIT_AUTHOR_DATE="$2" GIT_COMMITTER_DATE="$2" git commit -q --no-verify -m "$1"; }
git checkout -q -b feature/rounding
#   branch: money rounding switched to half-up (commercial rounding)
sed -i 's/ROUND_HALF_EVEN/ROUND_HALF_UP/g' invoice/calc.py
c "Use commercial rounding (half-up)" "2026-05-05T10:00:00Z"
git checkout -q master
#   master: the tax function now accepts the rate as a string, too, and both
#   rounding call sites were reformatted -- conflicting with the branch
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''    total = Decimal(quantity) * Decimal(str(unit_price))
    return total.quantize(CENT, rounding=ROUND_HALF_EVEN)''', '''    total = Decimal(quantity) * Decimal(str(unit_price))
    return total.quantize(CENT, ROUND_HALF_EVEN)''')
s = s.replace('''    value = Decimal(amount) * Decimal(str(rate)) / Decimal(100)
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)''', '''    rate = Decimal(rate.strip().rstrip("%")) if isinstance(rate, str) else Decimal(str(rate))
    value = Decimal(amount) * rate / Decimal(100)
    return value.quantize(CENT, ROUND_HALF_EVEN)''')
open(p, "w").write(s)
PY
c "Accept the tax rate as a string like '20%'" "2026-05-06T09:00:00Z"
git tag ase-test-base
git merge --no-edit feature/rounding > /dev/null 2>&1 || true
git ls-files -u | grep -q . || { echo "expected a conflict"; exit 1; }
