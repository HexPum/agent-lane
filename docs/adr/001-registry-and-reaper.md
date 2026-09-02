# ADR 001: Persistent registry and host-wide reaper

Status: proposed (2026-09-02)
> Rev note: decision delegated by the agent without a grill interview;
> user interview pending.

## Context

VM lifetime is bounded only by a host-side `setTimeout` in the creating Node
process. If that process crashes, or cleanup retries are exhausted, the VM leaks
with no trace. AGENTS.md treats fail-open cleanup as a correctness bug.

## Decision

1. Every `create` registers the lane in `~/.agent-lane/registry.json` (VM name,
   owner PID, created-at, expires-at) before the VM is started.
2. Successful teardown deregisters. Exhausted retries keep the entry.
3. `agent-lane reap` deletes only registered VMs whose expiry has passed and
   whose name passes `assertVmName`. It never globs or lists unregistered VMs.
4. Registry writes are atomic (temp file + rename) and tolerate stale entries
   from crashed owners.

## Consequences

- Crashed processes no longer leak VMs silently; the reaper is the recovery path.
- The reaper must be run periodically (manual or cron) until an upstream
  Sandcastle patch moves resource acquisition earlier.
