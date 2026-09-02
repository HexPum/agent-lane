# Review log

One line per code review: ticket, model tier, first-attempt PASS/FAIL, note.

| Ticket | Tier | First attempt | Note |
|---|---|---|---|

## Rückbau (rollback guide)

- **Lane branches**: tier-labeled worktrees merge only after review PASS;
  to undo a lane, `git revert <merge>` or `ORCA worktree rm --worktree <id>`.
- **ADR revert**: the six ADRs are `proposed`; reopening a decision is a new
  ADR revision, not an in-place edit.
- **Skills mess**: the third nested `agent/` path was installer-generated and
  removed in `chore: harden docs state`.
