# repo/stage-topic

`ase-repo-stage` with a topic: the working tree of the `invoice` project
(`setup.sh`) mixes two topics in the same two files, unstaged -- debug
logging and the rejection of negative tax rates. Only the validation hunks
must end up in the index (hunk splitting needed in `cli.py`, where both
topics touch nearby lines), the logging hunks must stay unstaged, and
nothing may be committed.
