source "$CASE_DIR/../_base/init.sh"
git tag ase-test-base
#   a staged feature: an optional percentage discount on the subtotal
python3 - <<'PY'
import re
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''def grand_total(lines, rate):
    """Subtotal plus tax."""
    net = subtotal(lines)
    return net + tax(net, rate)''', '''def discount(amount, percent):
    """Discount on an amount at a percentage, rounded to cents."""
    value = Decimal(amount) * Decimal(str(percent)) / Decimal(100)
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def grand_total(lines, rate, discount_percent=0):
    """Subtotal minus the optional discount, plus tax on the discounted amount."""
    net = subtotal(lines)
    net = net - discount(net, discount_percent)
    return net + tax(net, rate)''')
open(p, "w").write(s)
p = "invoice/cli.py"
s = open(p).read()
s = s.replace('''    rate = 20
    lines = []''', '''    rate = 20
    percent = 0
    lines = []''')
s = s.replace('''            rate = float(arg[len("--tax="):])
''', '''            rate = float(arg[len("--tax="):])
        elif arg.startswith("--discount="):
            percent = float(arg[len("--discount="):])
''')
s = s.replace("    return lines, rate\n", "    return lines, rate, percent\n")
s = s.replace('''    lines, rate = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate))''', '''    lines, rate, percent = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate, percent))''')
open(p, "w").write(s)
p = "invoice/render.py"
s = open(p).read()
s = s.replace("from .calc import subtotal, tax, grand_total", "from .calc import subtotal, tax, discount, grand_total")
s = s.replace("def render(lines, rate):", "def render(lines, rate, discount_percent=0):")
s = s.replace('''    net = subtotal(lines)
    out.append(f"Subtotal: {net}")''', '''    net = subtotal(lines)
    out.append(f"Subtotal: {net}")
    if discount_percent:
        off = discount(net, discount_percent)
        out.append(f"Discount ({discount_percent}%): -{off}")
        net = net - off''')
s = s.replace('''    out.append(f"Total: {grand_total(lines, rate)}")''', '''    out.append(f"Total: {grand_total(lines, rate, discount_percent)}")''')
open(p, "w").write(s)
PY
git add --all
