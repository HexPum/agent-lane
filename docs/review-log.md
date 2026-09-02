# Review log

One line per code review: ticket, model tier, first-attempt PASS/FAIL, note.

| Ticket | Tier     | First attempt | Note                                                                                                  |
| ------ | -------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| 001    | flash    | PASS          | sudo --preserve-env; stalled on pre-existing Prettier violations                                      |
| 002    | flash    | PASS          | maxCopyOutBytes; same Prettier block; asked before formatting foreign files                           |
| 003    | flash    | PASS          | maxConcurrentVms semaphore; index.lock sandbox issue prevented commit                                 |
| 004    | flash    | PASS          | Lima version check; read-only .agents files blocked format check                                      |
| 005    | frontier | FAIL→PASS     | Self-reported FAIL first (lock, bin-symlink, expiry fixes), then PASS                                 |
| 006    | frontier | PASS          | Template pinning + provenance; Prettier block; index.lock issue                                       |
| Ticket | Tier     | First attempt | Note                                                                                                  |
| ------ | -------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| 005    | frontier | FAIL          | Final Standards + Spec PASS after fail-closed registry, lock, bin-symlink, and absolute-expiry fixes. |

## Rückbau (rollback guide)

- **Lane branches**: tier-labeled worktrees merge only after review PASS;
  to undo a lane, `git revert <merge>` or `ORCA worktree rm --worktree <id>`.
- **ADR revert**: the six ADRs are `proposed`; reopening a decision is a new
  ADR revision, not an in-place edit.
- **Skills mess**: the third nested `agent/` path was installer-generated and
  removed in `chore: harden docs state`.
