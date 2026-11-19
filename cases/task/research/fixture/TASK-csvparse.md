---
Type:     text/vnd.ase.task
Id:       csvparse
Created:  2026-01-01 10:00
Modified: 2026-01-01 10:00
Status:   OPEN
Kind:     CRAFTING
---

#   TASK: Robust CSV Import for the Report Generator

##  SPECIFICATION (WHAT)

-   [ ] IFC: **Import**: `report import <file.csv>` reads customer records
    from a CSV export of the CRM (quoted fields, embedded newlines,
    semicolon or comma separators, UTF-8 with BOM).

##  DESIGN (HOW)

-   [ ] IMP: **Parser**: pick a maintained CSV parser library for Node.js
    instead of a hand-written split on commas.

##  VERIFICATION (CHECK)

-   [ ] TST: **Samples**: tests with a sample export of each separator.
