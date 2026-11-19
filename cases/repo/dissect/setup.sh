source "$CASE_DIR/../_base/init.sh"
git tag ase-test-base
#   three unrelated concerns in one uncommitted change set: (1) a currency
#   symbol in the rendering, (2) a README usage section, (3) a CLI --version
python3 - <<'PY'
p = "invoice/render.py"
s = open(p).read()
s = s.replace("def render(lines, rate):", "def render(lines, rate, currency=\"EUR\"):")
s = s.replace('''    out.append(f"Total: {grand_total(lines, rate)}")''', '''    out.append(f"Total: {grand_total(lines, rate)} {currency}")''')
open(p, "w").write(s)
p = "README.md"
s = open(p).read() + '''
## Usage

Each item is given as `<quantity>x<unit price>`; the tax rate defaults to
20 percent and is changed with `--tax=<rate>`.
'''
open(p, "w").write(s)
p = "invoice/cli.py"
s = open(p).read()
s = s.replace('''from .render import render
''', '''from .render import render

VERSION = "0.4.0"
''')
s = s.replace('''    for arg in argv:
        if arg.startswith("--tax="):''', '''    for arg in argv:
        if arg == "--version":
            print(VERSION)
            raise SystemExit(0)
        if arg.startswith("--tax="):''')
open(p, "w").write(s)
PY
