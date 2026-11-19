# help/intent-dispatch

`ase-help-intent` matches a free-text intent (split a mixed change set into
separately committable parts) against the help of all skills. The proposals
must include `/ase:ase-repo-dissect`; the simulated user cancels the dispatch
dialog, so nothing is executed (`gitDiff` empty).
