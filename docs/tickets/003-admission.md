# Ticket 003: maxConcurrentVms admission control

Spec: item 4. ADR: 004. Blocked by: none. Tier: flash.

## Problem
Nothing bounds concurrent VMs per provider instance.

## Work
1. Add `readonly maxConcurrentVms?: number` to `LimaProviderOptions`, default 2,
   `positiveInteger(..., 32)`.
2. Implement an in-process async semaphore in `lima()`: `create` awaits a free
   slot before `limactl start`; the slot releases when the handle's `close`
   settles (success or failure).
3. Tests: with a fake runtime, third concurrent create waits until an earlier
   handle closes; released slots are reusable; option validation rejects 0.
4. `npm run check` green.

## Seams
- Wrap `create` and hook release into the existing `close` promise; do not
  change teardown semantics.
