# Ticket 010: vendor the Claude installer (supersedes hash-pinning)

Spec: item 5. ADR: 007 (revises 005). Blocked by: none. Tier: flash.

## Problem

The pinned SHA256 of https://claude.ai/install.sh no longer matches the live
installer (live: 3a68d34..., pinned: cde4f17...). Hash-pinning a live URL is
operationally broken: every upstream change fails provisioning fail-closed.

## Work

1. Vendor the reviewed installer into
   `packages/provider-lima/templates/vendor/claude-install.sh` (record source
   URL, fetch date, and SHA256 in a header comment).
2. Template installs from the vendored copy (inline heredoc or Lima
   copyToHost — pick the simpler one, justify in the commit message).
3. Update `provenance.ts` to hash the vendored bytes; keep fail-closed.
4. Verify the vendored script hash matches the provenance test fixture.
5. `npm run check` green.

## Seams

- templates/, provenance.ts, template tests. No provider.ts changes.
