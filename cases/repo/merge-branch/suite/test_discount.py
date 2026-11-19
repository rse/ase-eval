import unittest
from decimal import Decimal

from invoice.calc import grand_total, discount


class TestDiscount (unittest.TestCase):
    def test_discount_helper (self):
        self.assertEqual(discount(Decimal("24.98"), 10), Decimal("2.50"))

    def test_grand_total_without_discount (self):
        self.assertEqual(grand_total([ (2, 9.99), (1, 5.00) ], 20), Decimal("29.98"))

    def test_grand_total_with_discount (self):
        self.assertEqual(grand_total([ (2, 9.99), (1, 5.00) ], 20, 10), Decimal("26.98"))
