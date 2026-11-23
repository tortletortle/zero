# Cursor Playbook

1. Read `docs/ENGINEERING_SPEC.md`, `TASKS.md`, and `docs/VALIDATION_LOG.md` before changing code.
2. Execute one Task ID at a time. Avoid broad rewrites while the prototype baseline is being established.
3. Preserve a runnable browser build after each task.
4. Run the listed static checks and record exact commands, exit codes, and outcomes.
5. If a browser, GPU, or Android test cannot be performed, mark it **not tested** rather than inferring success.
6. Do not reduce visual quality or remove working controls to make a test pass without recording the trade-off.
