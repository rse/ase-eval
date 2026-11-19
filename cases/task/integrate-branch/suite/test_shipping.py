import unittest
from decimal import Decimal

from invoice.calc import grand_total


class TestShipping (unittest.TestCase):
    def test_without_shipping (self):
        self.assertEqual(grand_total([ (2, 9.99) ], 20), Decimal("23.98"))

    def test_with_shipping (self):
        self.assertEqual(grand_total([ (2, 9.99) ], 20, 5), Decimal("29.98"))
