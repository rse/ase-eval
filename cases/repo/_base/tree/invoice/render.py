from .calc import subtotal, tax, grand_total


def render(lines, rate):
    """Render an invoice as plain text, one line per item plus totals."""
    out = []
    for quantity, unit_price in lines:
        out.append(f"{quantity} x {unit_price:.2f}")
    net = subtotal(lines)
    out.append(f"Subtotal: {net}")
    out.append(f"Tax ({rate}%): {tax(net, rate)}")
    out.append(f"Total: {grand_total(lines, rate)}")
    return "\n".join(out)
