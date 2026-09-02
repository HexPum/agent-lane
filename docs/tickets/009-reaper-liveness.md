# Ticket 009: reaper owner-liveness + stale-entry cleanup

Spec: item 1. ADR: 001. Blocked by: 005 (merge). Tier: flash.

## Problem

Found in post-implementation review of 005:

1. `agent-lane reap` deletes every expired registered VM without checking
   whether the owner PID is still alive. A legitimate long-running lane past
   its expiry gets killed under its live owner. The in-band timeout
   (scheduleClose) already handles live-owner expiry; the reaper is the
   backstop for dead owners.
2. If the owner crashes between `register()` and `limactl start`, the entry
   points at a VM that never existed. `limactl delete` then fails forever and
   the entry stays in `failed` on every reap run.

## Work

1. In `reap.ts`: skip entries whose `ownerPid` is alive (reuse the
   liveness-check approach from registry.ts), unless a `--force` flag is
   passed.
2. Treat "instance does not exist" from `limactl delete` as reaped:
   deregister and count as success.
3. Tests: live-owner entry is skipped; dead-owner expired entry is reaped;
   nonexistent VM deregisters cleanly; `--force` reaps despite live owner.
4. `npm run check` green.

## Seams

- `reap.ts` and its tests only; no provider.ts changes.
