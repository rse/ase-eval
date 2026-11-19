# spec/import-lint-export

Bootstrapping a specification over three skills: `ase-sync-import --target
SPEC` imports kick-off meeting notes of a room booking service into an
empty SpecBook specification (`ase spec init`, `setup.sh`), `ase-spec-lint
--auto` fixes the lint findings, and `ase-sync-export --output
docs/spec.html` renders it. Checked: `ase spec lint` clean, key requirements
and glossary terms present, the HTML export, and a rubric.
