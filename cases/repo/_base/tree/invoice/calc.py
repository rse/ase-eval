from decimal import Decimal, ROUND_HALF_EVEN

CENT = Decimal("0.01")


def line_total(quantity, unit_price):
    """Total of one invoice line, rounded to cents."""
    total = Decimal(quantity) * Decimal(str(unit_price))
    return total.quantize(CENT, rounding=ROUND_HALF_EVEN)


def subtotal(lines):
    """Sum of all line totals of (quantity, unit_price) pairs."""
    return sum((line_total(q, p) for q, p in lines), Decimal("0.00"))


def tax(amount, rate):
    """Tax for an amount at a percentage rate, rounded to cents."""
    value = Decimal(amount) * Decimal(str(rate)) / Decimal(100)
    return value.quantize(CENT, rounding=ROUND_HALF_EVEN)


def grand_total(lines, rate):
    """Subtotal plus tax."""
    net = subtotal(lines)
    return net + tax(net, rate)
