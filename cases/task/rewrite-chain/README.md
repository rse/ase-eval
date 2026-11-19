# task/rewrite-chain

Three plan-rewriting skills on one verbose epic (`webshop`):
`ase-task-condense` must shrink the wording (the plan file from about 3600
to below 3000 chars), `ase-task-reboot` re-creates the plan, and `ase-task-dissect
--max-parts 3` splits it into domain-wise sub-tasks. Checked: 2-3 sub-task
files covering search, checkout, and reporting, each with the WHAT/HOW/
verification sections, and together keeping the key requirements of the
epic (pagination, guest checkout, CSV export, low-stock threshold, the
full-text design, postal-code validation).
