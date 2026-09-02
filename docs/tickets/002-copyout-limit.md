# Ticket 002: configurable copy-out ceiling

Spec: item 3. ADR: 003. Blocked by: none. Model tier: unverified (flash-candidate).

## Problem
`copyFileOut` hardcodes `256 * 1024 * 1024` in the `capture` call.

## Work
1. Add `readonly maxCopyOutBytes?: number` to `LimaProviderOptions`
   (`src/types.ts`), default 256 MiB, validated with `positiveInteger(value,
   "maxCopyOutBytes", 4 * 1024 ** 3)` in `lima()`.
2. Thread the value through `createHandle` into the `capture` call.
3. Tests: default applies; invalid values (0, negative, > 4 GiB) reject.
4. `npm run check` green.

## Seams
- Options validation and handle wiring; capture semantics unchanged.
