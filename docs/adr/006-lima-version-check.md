# ADR 006: Fail fast on unsupported Lima

Status: proposed (2026-09-02)
> Rev note: decision delegated by the agent without a grill interview;
> user interview pending.

## Context

`--mount-none` requires Lima 2.x. On Lima 1.x the provider fails with a cryptic
limactl error instead of a clear message.

## Decision

On first `create`, run `limactl --version`, parse the major version, and reject
with a clear error message if major < 2. The check runs once per provider
instance, not per create.

## Consequences

- Clear failure mode on unsupported hosts.
- One unit test covers parse and rejection.
