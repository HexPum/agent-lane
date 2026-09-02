# ADR 005: Pin and verify guest provisioning

Status: proposed (2026-09-02)
> Rev note: decision delegated by the agent without a grill interview;
> user interview pending.

## Context

The template pipes `claude.ai/install.sh` into bash unpinned and unverified. A
compromised installer runs inside every lane. Codex is pinned (@0.151.0) but not
hash-verified; NodeSource is unpinned.

## Decision

1. Pin the Claude installer by SHA256: download, verify against a pinned hash,
   fail closed on mismatch. Bump the hash via a reviewed PR.
2. Keep codex pinned; add the version to the run manifest.
3. Record provenance (Lima version, template file hash, agent versions) in a
   run manifest entry per create, stored in the registry record.

## Consequences

- Supply-chain changes require an explicit, reviewable hash bump.
- Every lane carries an auditable provenance record.
