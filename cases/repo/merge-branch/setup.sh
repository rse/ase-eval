source "$CASE_DIR/../_base/init.sh"
git tag ase-test-base
c () { git add --all; GIT_AUTHOR_DATE="$2" GIT_COMMITTER_DATE="$2" git commit -q --no-verify -m "$1"; }
git checkout -q -b feature/discount
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''def grand_total(lines, rate):''', '''def discount(amount, percent):
    """Discount on an amount at a percentage, rounded to cents."""
    value = Decimal(amount) * Decimal(str(percent)) / Decimal(100)
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def grand_total(lines, rate):''')
open(p, "w").write(s)
PY
c "Add discount() helper" "2026-05-05T10:00:00Z"
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''def grand_total(lines, rate):
    """Subtotal plus tax."""
    net = subtotal(lines)
    return net + tax(net, rate)''', '''def grand_total(lines, rate, discount_percent=0):
    """Subtotal minus the optional discount, plus tax on the discounted amount."""
    net = subtotal(lines)
    net = net - discount(net, discount_percent)
    return net + tax(net, rate)''')
open(p, "w").write(s)
PY
c "Apply the discount in grand_total()" "2026-05-05T11:00:00Z"
git checkout -q master
#   master moved on meanwhile (unrelated)
printf '\n## License\n\nMIT\n' >> README.md
c "Add a license section" "2026-05-06T09:00:00Z"
