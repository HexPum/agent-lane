# Ticket 007: opt-in integration suite

Spec: item 7. Blocked by: 005 (registry), 003 (admission). Tier: frontier.

## Problem
The POC checklist is manual; nothing automates it on real machines.

## Work
1. New `tests/integration/*.test.ts` skipped unless
   `process.env.AGENT_LANE_INTEGRATION === "1"`.
2. Automate POC points: 2 (two concurrent lanes, unique names), 3 (no host
   paths in guest), 7 (copyIn variants), 8 (copyFileOut rejections), 10
   (lifetime expiry), 11 (commit + untracked file round-trip).
3. Use a clean throwaway git repo fixture; never touch real secrets.
4. Document the run in `docs/POC.md` (one line: how to run the suite).
5. `npm run check` green; suite itself runs only with the env flag.

## Seams
- New test directory; no production code changes expected.
