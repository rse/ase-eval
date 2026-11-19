source "$CASE_DIR/../_base/init.sh"
git tag ase-test-base
#   two unrelated topics in the same files, unstaged: (1) debug logging,
#   (2) a bug fix of tax(): the rate came in as float and lost precision
python3 - <<'PY'
p = "invoice/calc.py"
s = open(p).read()
s = s.replace('''from decimal import Decimal, ROUND_HALF_EVEN''', '''import logging
from decimal import Decimal, ROUND_HALF_EVEN

log = logging.getLogger(__name__)''')
s = s.replace('''    """Sum of all line totals of (quantity, unit_price) pairs."""
    return sum((line_total(q, p) for q, p in lines), Decimal("0.00"))''', '''    """Sum of all line totals of (quantity, unit_price) pairs."""
    log.debug("subtotal of %d lines", len(lines))
    return sum((line_total(q, p) for q, p in lines), Decimal("0.00"))''')
s = s.replace('''    value = Decimal(amount) * Decimal(str(rate)) / Decimal(100)
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def grand_total''', '''    if Decimal(str(rate)) < 0:
        raise ValueError("tax rate must not be negative")
    value = Decimal(amount) * Decimal(str(rate)) / Decimal(100)
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def grand_total''')
s = s.replace('''    net = subtotal(lines)
    return net + tax(net, rate)''', '''    net = subtotal(lines)
    log.debug("grand total: net %s at %s%%", net, rate)
    return net + tax(net, rate)''')
open(p, "w").write(s)
p = "invoice/cli.py"
s = open(p).read()
s = s.replace('''            rate = float(arg[len("--tax="):])''', '''            rate = float(arg[len("--tax="):])
            if rate < 0:
                raise SystemExit("invoice: error: --tax must not be negative")''')
s = s.replace('''def main(argv=None):
''', '''def main(argv=None):
    logging.basicConfig(level=logging.DEBUG if "--debug" in sys.argv else logging.WARNING)
''')
s = s.replace("import sys\n", "import logging\nimport sys\n")
open(p, "w").write(s)
PY
