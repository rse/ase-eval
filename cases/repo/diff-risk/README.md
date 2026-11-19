# repo/diff-risk

`ase-repo-diff --coherence --risk --blast` on a staged, subtly breaking
change of the `invoice` project (`setup.sh`): `tax()` takes the rate as a
fraction instead of a percentage, while its callers `grand_total()`,
`render()`, and the CLI were not adapted (taxes 100x too high). The rubric expects the incoherent call site,
the risks, and the blast radius to be named; nothing may be changed.
