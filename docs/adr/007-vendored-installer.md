# ADR 007: Vendored Claude installer (revises ADR 005)

Status: accepted (2026-09-02)

## Context

ADR 005 pinned the Claude installer by SHA256 against the live URL. Post-merge
verification found the live hash no longer matches the pin; every upstream
installer change would break provisioning fail-closed without warning.

## Decision

Vendor the reviewed installer into the repo
(`templates/vendor/claude-install.sh`) with source URL, fetch date, and
SHA256 recorded in a header comment. The template installs only from vendored
bytes. Updates happen as reviewed PRs that replace the file and bump the
header. Provenance hashes the vendored bytes (fail-closed, unchanged).

## Consequences

- Provisioning is reproducible and independent of upstream availability.
- Installer updates become visible, reviewable diffs.
- ADR 005 remains accepted for Codex (npm version pin); its Claude-installer
  hash-pinning clause is superseded by this ADR.
