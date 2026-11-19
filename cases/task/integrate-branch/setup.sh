source "$CASE_DIR/../../repo/_base/init.sh"
c () { git add --all; GIT_AUTHOR_DATE="$2" GIT_COMMITTER_DATE="$2" git commit -q --no-verify -m "$1"; }
git checkout -q -b feature/shipping
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''def grand_total(lines, rate):
    """Subtotal plus tax."""
    net = subtotal(lines)
    return net + tax(net, rate)''', '''def grand_total(lines, rate, shipping=0):
    """Subtotal plus a flat shipping fee, plus tax on both."""
    net = subtotal(lines) + Decimal(str(shipping)).quantize(CENT)
    return net + tax(net, rate)''')
open(p, "w").write(s)
PY
c "Add a flat, taxed shipping fee to grand_total()" "2026-05-06T10:00:00Z"
python3 - <<'PY'
p = "invoice/cli.py"
s = open(p).read()
s = s.replace('''from .render import render
''', '''from .calc import grand_total
from .render import render
''')
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
s = s.replace("    return lines, rate\n", "    return lines, rate, shipping\n")
s = s.replace('''    lines, rate = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate))''', '''    lines, rate, shipping = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate))
    if shipping:
        print(f"Total incl. shipping: {grand_total(lines, rate, shipping)}")''')
open(p, "w").write(s)
PY
c "Add the --shipping option to the CLI" "2026-05-06T11:00:00Z"
git checkout -q master
printf '\n## License\n\nMIT\n' >> README.md
c "Add a license section" "2026-05-07T09:00:00Z"
git tag ase-test-base
