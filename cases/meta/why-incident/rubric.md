# Rubric: Five-Whys Analysis of a CI Disk-Quota Failure

The output is a Five-Whys root-cause analysis of a nightly CI pipeline
failing with "disk quota exceeded" on a shared runner, although every job
deletes its workspace. Score each criterion and average them:

1.  **Depth**: the causal chain goes about five levels deep, each "why"
    following from the previous answer.
2.  **Width**: at least two alternative causal branches are explored
    (e.g. caches/docker layers outside the workspace, cleanup skipped on
    failed or cancelled jobs, other tenants of the shared runner, logs or
    artifacts in temporary directories).
3.  **Plausibility**: each step is technically plausible for CI runners;
    the analysis does not stop at the symptom.
4.  **Root cause**: it ends at actionable root causes (process or system
    level), not at "the disk is full".
5.  **Solutions**: concrete countermeasures per root cause (e.g. cleanup
    in an always-run step, quota monitoring, cache pruning, isolated
    runners).
