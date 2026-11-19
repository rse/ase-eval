# spec/edit-query-reconcile

Working with an existing SpecBook specification of a room booking service
(the result of `spec/import-lint-export`, committed as the fixture), over
three skills: `ase-spec-activate` answers a question from the specification
(4 hours, 15-minute steps, 30 days), `ase-spec-edit -v light` adds a `COULD`
requirement for recurring weekly bookings, and `ase-sync-reconcile --target
DOCS --source SPEC` updates the outdated README (30-minute steps, 2 hours,
14 days, no no-show release). Checked: lint clean, the new requirement, and
the README content.
