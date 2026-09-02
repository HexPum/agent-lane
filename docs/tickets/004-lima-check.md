# Ticket 004: fail fast on unsupported Lima

Spec: item 6. ADR: 006. Blocked by: none. Tier: flash.

## Problem
Lima 1.x hosts fail inside `limactl start` with a cryptic error (`--mount-none`
unsupported).

## Work
1. On first `create`, run `limactl --version` through the runtime; parse the
   major version; reject with: "agent-lane requires Lima 2.x or newer (found
   <v>). brew upgrade lima".
2. Check once per provider instance (memoized promise); failures reject every
   subsequent create.
3. Tests: version strings "limactl version 2.1.0" pass; "1.3.15" and garbage
   reject with the clear message.
4. `npm run check` green.

## Seams
- New small module `src/limaVersion.ts` + wiring in `create`; no other changes.
