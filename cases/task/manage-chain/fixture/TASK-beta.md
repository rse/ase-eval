---
Type:     text/vnd.ase.task
Id:       beta
Created:  2026-01-01 10:00
Modified: 2026-01-01 10:00
Status:   OPEN
Kind:     CRAFTING
---

#   TASK: Command-Line Flags for the Report Generator

##  SPECIFICATION (WHAT)

-   [ ] IFC: **Format Flag**: `report --format csv|json|md` selects the
    output format; `md` is the default.

-   [ ] IFC: **Output Flag**: `report --output <file>` writes to a file
    instead of stdout; an existing file is only overwritten with `--force`.

-   [ ] IFC: **Errors**: an unknown flag or format prints a usage line to
    stderr and exits with code 2.

##  DESIGN (HOW)

-   [ ] IMP: **Parser**: use `node:util` `parseArgs` (no dependency),
    with all flag definitions in one table in `src/cli.js`.

-   [ ] IMP: **Writers**: one writer function per format in
    `src/format/`, selected by a lookup table.

##  VERIFICATION (CHECK)

-   [ ] TST: **Unit**: tests for each format writer and for the parser
    (valid, unknown flag, unknown format, missing `--force`).
