# ADR 003: Configurable copy-out ceiling

Status: proposed (2026-09-02)
> Rev note: decision delegated by the agent without a grill interview;
> user interview pending.

## Context

`copyFileOut` hardcodes a 256 MiB ceiling. Build artifacts (Blender renders,
media) can exceed it, and callers cannot raise it.

## Decision

Add `maxCopyOutBytes` to `LimaProviderOptions` (default: 256 MiB, validated as a
positive safe integer). The value flows into the `capture` call.

## Consequences

- Large artifacts no longer hard-fail; the default keeps the old bound.
- Validation reuses `positiveInteger` with a sane max (4 GiB).
