import sys

from .render import render


def parse(argv):
    """Parse "<quantity>x<price>" items and an optional "--tax=<rate>"."""
    rate = 20
    lines = []
    for arg in argv:
        if arg.startswith("--tax="):
            rate = float(arg[len("--tax="):])
        else:
            quantity, price = arg.split("x", 1)
            lines.append((int(quantity), float(price)))
    return lines, rate


def main(argv=None):
    lines, rate = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate))
    return 0


if __name__ == "__main__":
    sys.exit(main())
