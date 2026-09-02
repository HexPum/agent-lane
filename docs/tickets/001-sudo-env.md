# Ticket 001: sudo preserves task environment

Spec: docs/specs/production-ready.md (item 2). ADR: 002.
Blocked by: none. Tier: flash.

## Problem
`exec` with `execOptions.sudo` builds `sudo -- bash -lc <cmd>`. sudo's
`env_reset` drops the sourced task env, so elevated commands run without it.

## Work
1. In `packages/provider-lima/src/provider.ts`, change the elevated form to
   `sudo --preserve-env -- bash -lc <command>`.
2. Add a unit test in `tests/provider.test.ts`: with a fake runtime, exec with
   `sudo: true` must produce a script containing `sudo --preserve-env --`.
3. `npm run check` green.

## Seams
- `exec` script construction only; no lifecycle changes.
