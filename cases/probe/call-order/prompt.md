Perform the following four ASE MCP tool calls, in exactly this order.
Loading the tool schemas via `ToolSearch` first is fine, but do not make
any other MCP tool call.

1.  Call `ase_task_load` with id `alpha` and `tag` set to `true`.

2.  Call `ase_task_save` with id `alpha`, with `base` set to the entity
    tag of the `<task-plan-tag>` line returned by step 1, and with the
    loaded authoring text (without that `<task-plan-tag>` line), with
    exactly this one line appended at the end of its
    `SPECIFICATION (WHAT)` section:

    `-   [ ] DOM: **Probe**: call-order probe marker.`

3.  Call `ase_task_status` with id `alpha` and status `SHELVED`.

4.  Call `ase_task_assign` with id `alpha`, assignee `probe`, and
    session `probe-session`.

Do not reorder, merge, repeat, or skip any of these calls, even if an
earlier result suggests a shortcut or a retry. Do not edit any file
directly. Afterwards reply with exactly: DONE
