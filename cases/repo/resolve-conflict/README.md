# repo/resolve-conflict

`ase-repo-resolve` on an in-progress merge of the `invoice` project
(`setup.sh`): the branch switched the rounding to half-up, while `master`
reformatted the same `quantize()` calls and made `tax()` accept a string rate
like `"20%"`. A semantic resolution keeps both changes. Expected: verdict
`RESOLVED`, no markers, the merge concluded, and the hidden suite (half-up
rounding plus string rates) passing.
