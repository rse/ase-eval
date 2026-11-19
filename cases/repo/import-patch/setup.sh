source "$CASE_DIR/../_base/init.sh"
#   an external patch (made against the initial version) adding a --currency
#   option, plus an uncommitted local edit touching nearby lines of cli.py
mkdir -p patches
cp invoice/cli.py /tmp/ase-cli-orig.$$
python3 - <<'PY'
p = "invoice/cli.py"
s = open(p).read()
s = s.replace('''    rate = 20
    lines = []''', '''    rate = 20
    currency = "EUR"
    lines = []''')
s = s.replace('''            rate = float(arg[len("--tax="):])
''', '''            rate = float(arg[len("--tax="):])
        elif arg.startswith("--currency="):
            currency = arg[len("--currency="):].upper()
''')
s = s.replace("    return lines, rate\n", "    return lines, rate, currency\n")
s = s.replace('''    lines, rate = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate))''', '''    lines, rate, currency = parse(sys.argv[1:] if argv is None else argv)
    print(render(lines, rate))
    print(f"Currency: {currency}")''')
open(p, "w").write(s)
PY
git diff > patches/currency.patch
git checkout -q -- invoice/cli.py
git add patches/currency.patch
GIT_AUTHOR_DATE="2026-05-05T09:00:00Z" GIT_COMMITTER_DATE="2026-05-05T09:00:00Z" git commit -q --no-verify -m "Add the contributed currency patch for review"
git tag ase-test-base
#   local uncommitted work: the default tax rate became 19 and is documented
sed -i 's/    rate = 20$/    rate = 19  # the reduced default rate of our main market/' invoice/cli.py
sed -i 's/defaults to/defaults to/' README.md
rm -f /tmp/ase-cli-orig.$$
