##
##  oracle.py -- the hidden reference implementation of "csvq.py", run by the
##  "exec" oracles in the case directory and never shown to the tested session
##

import sys
import csv
import io


def fail (message):
    sys.stderr.write("csvq: error: %s\n" % message)
    sys.exit(1)


def numeric (text):
    try:
        return float(text)
    except ValueError:
        return None


OPS = [ "<=", ">=", "==", "!=", "<", ">" ]


def main ():
    args = sys.argv[1:]
    if len(args) == 0:
        fail("missing command")
    command = args[0]
    rows = list(csv.reader(io.StringIO(sys.stdin.read())))
    if len(rows) == 0:
        fail("empty input")
    header, body = rows[0], rows[1:]
    out = csv.writer(sys.stdout, lineterminator="\n")

    def colidx (name):
        if name not in header:
            fail("unknown column \"%s\"" % name)
        return header.index(name)

    def field (row, i):
        return row[i] if i < len(row) else ""

    def numbers (name):
        i = colidx(name)
        values = []
        for row in body:
            value = field(row, i)
            number = numeric(value)
            if number is None:
                fail("non-numeric value \"%s\" in column \"%s\"" % (value, name))
            values.append(number)
        if len(values) == 0:
            fail("no rows")
        return values

    if command == "select":
        if len(args) != 2:
            fail("usage: select <column>[,<column>...]")
        names = args[1].split(",")
        idx = [ colidx(name) for name in names ]
        out.writerow(names)
        for row in body:
            out.writerow([ field(row, i) for i in idx ])
    elif command == "filter":
        if len(args) != 2:
            fail("usage: filter <column><op><value>")
        expression = args[1]
        for op in OPS:
            pos = expression.find(op)
            if pos > 0:
                name, value = expression[:pos], expression[pos + len(op):]
                break
        else:
            fail("invalid filter expression \"%s\"" % expression)
        i = colidx(name)
        out.writerow(header)
        vnum = numeric(value)
        for row in body:
            text = field(row, i)
            fnum = numeric(text)
            if fnum is not None and vnum is not None:
                a, b = fnum, vnum
            else:
                a, b = text, value
            keep = ( a == b if op == "==" else a != b if op == "!=" else
                     a <  b if op == "<"  else a >  b if op == ">"  else
                     a <= b if op == "<=" else a >= b )
            if keep:
                out.writerow(row)
    elif command == "count":
        if len(args) != 1:
            fail("usage: count")
        sys.stdout.write("%d\n" % len(body))
    elif command == "sum":
        if len(args) != 2:
            fail("usage: sum <column>")
        total = sum(numbers(args[1]))
        sys.stdout.write(("%d\n" % int(total)) if total == int(total) else ("%r\n" % total))
    elif command == "avg":
        if len(args) != 2:
            fail("usage: avg <column>")
        values = numbers(args[1])
        sys.stdout.write("%.2f\n" % (sum(values) / len(values)))
    else:
        fail("unknown command \"%s\"" % command)


main()
