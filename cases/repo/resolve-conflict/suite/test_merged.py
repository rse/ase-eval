import unittest
from decimal import Decimal

from invoice.calc import line_total, tax


class TestMerged (unittest.TestCase):
    def test_half_up_line_total (self):
        #   0.125 rounds up with commercial rounding (half-even would give 0.12)
        self.assertEqual(line_total(1, 0.125), Decimal("0.13"))

    def test_half_up_tax (self):
        #   2.5% of 0.50 is 0.0125 -> 0.01 either way; 5% of 0.50 = 0.025 -> 0.03 half-up
        self.assertEqual(tax(Decimal("0.50"), 5), Decimal("0.03"))

    def test_tax_rate_as_string (self):
        self.assertEqual(tax(Decimal("100.00"), "20%"), Decimal("20.00"))
        self.assertEqual(tax(Decimal("100.00"), " 7.5 "), Decimal("7.50"))
