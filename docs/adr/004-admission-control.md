# ADR 004: Host-side admission control

Status: proposed (2026-09-02)
> Rev note: decision delegated by the agent without a grill interview;
> user interview pending.

## Context

Nothing bounds concurrent VMs. Two lanes at the example defaults (8 CPU / 16 GiB)
exhaust a 16 GiB host. This is the most likely day-to-day failure.

## Decision

Add `maxConcurrentVms` to `LimaProviderOptions` (default: 2). `create` acquires
a slot from an in-process semaphore and releases it when the handle closes.
Queued creates wait; they do not fail.

## Consequences

- Parallel Sandcastle runs queue instead of exhausting the host.
- The bound is per provider instance (per process), not host-wide; the registry
  from ADR 001 is the host-wide view.
