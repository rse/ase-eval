##
##  test_csvq.py -- the hidden test suite of "csvq.py", copied into the
##  sandbox project only after the last stage (run from the project root)
##

import subprocess
import sys
import unittest

#   the test input: header plus five data rows, with a quoted comma, an
#   escaped double quote, an empty field, a needlessly quoted field, and
#   an embedded newline
CSV = (
    'name,team,points,comment\n'
    'Alice,Red,12,"likes ""quotes"" a lot"\n'
    'Bob,Blue,7,"comma, inside"\n'
    'Carla,Red,9,\n'
    'Dan,"Blue",15,plain\n'
    'Eve,Green,11,"two\nlines"\n'
)

def csvq (args, data = CSV):
    return subprocess.run([ sys.executable, "csvq.py" ] + args,
        input = data, capture_output = True, text = True, timeout = 30)

def out (proc):
    return proc.stdout.replace("\r\n", "\n").rstrip("\n")

class TestCsvq (unittest.TestCase):
    def test_select_single (self):
        p = csvq([ "select", "name" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p), "name\nAlice\nBob\nCarla\nDan\nEve")

    def test_select_multi_keeps_quoting (self):
        p = csvq([ "select", "name,comment" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p),
            'name,comment\n'
            'Alice,"likes ""quotes"" a lot"\n'
            'Bob,"comma, inside"\n'
            'Carla,\n'
            'Dan,plain\n'
            'Eve,"two\nlines"')

    def test_select_drops_needless_quotes (self):
        p = csvq([ "select", "team" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p), "team\nRed\nBlue\nRed\nBlue\nGreen")

    def test_filter_numeric_not_string (self):
        #   string comparison would drop "12" and "15" ("12" < "9" lexically)
        p = csvq([ "filter", "points>9" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p),
            'name,team,points,comment\n'
            'Alice,Red,12,"likes ""quotes"" a lot"\n'
            'Dan,Blue,15,plain\n'
            'Eve,Green,11,"two\nlines"')

    def test_filter_string_equality (self):
        p = csvq([ "filter", "team==Red" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p),
            'name,team,points,comment\n'
            'Alice,Red,12,"likes ""quotes"" a lot"\n'
            'Carla,Red,9,')

    def test_filter_less_equal (self):
        p = csvq([ "filter", "points<=9" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p),
            'name,team,points,comment\n'
            'Bob,Blue,7,"comma, inside"\n'
            'Carla,Red,9,')

    def test_count_embedded_newline_row_once (self):
        p = csvq([ "count" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p), "5")

    def test_sum_integer (self):
        p = csvq([ "sum", "points" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p), "54")

    def test_avg_two_decimals (self):
        p = csvq([ "avg", "points" ])
        self.assertEqual(p.returncode, 0)
        self.assertEqual(out(p), "10.80")

    def test_unknown_column (self):
        p = csvq([ "select", "nope" ])
        self.assertEqual(p.returncode, 1)
        self.assertTrue(p.stderr.startswith("csvq: error:"), p.stderr)

    def test_unknown_command (self):
        p = csvq([ "frobnicate" ])
        self.assertEqual(p.returncode, 1)
        self.assertTrue(p.stderr.startswith("csvq: error:"), p.stderr)

    def test_sum_non_numeric (self):
        p = csvq([ "sum", "comment" ])
        self.assertEqual(p.returncode, 1)
        self.assertTrue(p.stderr.startswith("csvq: error:"), p.stderr)

if __name__ == "__main__":
    unittest.main()
