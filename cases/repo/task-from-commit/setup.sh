source "$CASE_DIR/../_base/init.sh"
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''def grand_total(lines, rate):
    """Subtotal plus tax."""
    net = subtotal(lines)
    return net + tax(net, rate)''', '''def grand_total(lines, rate, shipping=0):
    """Subtotal plus tax, plus an optional flat shipping fee (taxed as well)."""
    net = subtotal(lines) + Decimal(str(shipping)).quantize(CENT)
    return net + tax(net, rate)''')
open(p, "w").write(s)
p = "invoice/cli.py"
s = open(p).read()
s = s.replace('''    rate = 20
    lines = []''', '''    rate = 20
    shipping = 0
    lines = []''')
s = s.replace('''            rate = float(arg[len("--tax="):])
''', '''            rate = float(arg[len("--tax="):])
        elif arg.startswith("--shipping="):
            shipping = float(arg[len("--shipping="):])
            if shipping < 0:
                raise SystemExit("invoice: error: --shipping must not be negative")
''')
open(p, "w").write(s)
PY
GIT_AUTHOR_DATE="2026-05-07T09:00:00Z" GIT_COMMITTER_DATE="2026-05-07T09:00:00Z" git commit -q -a --no-verify -m "Support a flat, taxed shipping fee"
git tag ase-test-base
