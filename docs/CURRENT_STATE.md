# agent-lane — current state (2026-09-02)

Single source of truth after context compaction. Read this first.

## Position

- Repo: HexPum/agent-lane (public), main = ded0f66..68fa0e3, CI green (ubuntu).
- In main: provider-lima + tests + docs + tickets 001-004, 006 merged
  (44/35 tests green, prettier baseline fixed in ded0f66).
- Ticket 005 (registry+reaper): implemented in worktree
  `HexPum/ticket-005`, NOT yet merged. 32 tests green in-lane.
- Tickets 007/008: intentionally stopped, pending decision after fixes.
- New: 009 (reaper liveness + stale-entry cleanup), 010 (vendor installer)
  created as preconditions; ADR-007 supersedes ADR-005's installer pinning.

## Known defects to fix before 007/008

1. Reaper ignores owner-liveness (kills VMs of live owners past expiry) and
   keeps entries for VMs that never existed. Ticket 009.
2. Claude installer hash-pin is stale (live hash differs). Ticket 010 +
   ADR-007: vendor the installer instead.

## Operating rules (still binding)

- One ticket per worktree; test-first; `npm run check` green before commit;
  review-lane (fresh context) before merging anything ≥ medium risk.
- Visible orchestration via Orca terminals (two-step spawn with
  `terminal wait --for tui-idle` before `terminal send`); no more nohup.
- `~/.codex/config.toml`: approval_policy="never" globally (set by me —
  revisit: better only inside flash profile). DeepSeek profile:
  `codex --profile flash` (deepseek-v4-flash, low effort), API key in
  DEEPSEEK_API_KEY (set in ~/.zshrc). Off-peak 12:00-03:00 CEST.
- Stop-gate: nothing beyond 008 without user decision.

## Process lessons (keep short)

- Fix format/lint baseline BEFORE spawning lanes.
- Merge same-file tickets sequentially, not parallel.
- Never union-merge source files; resolve conflicts semantically.
- review-log.md must be filled per lane at merge time, not retroactively.
