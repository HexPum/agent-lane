# Ticket 005: persistent registry and reaper

Spec: item 1. ADR: 001. Blocked by: none. Tier: frontier.

## Problem

Crashed owner processes and exhausted cleanup retries leak VMs with no trace.

## Work

1. New module `src/registry.ts`: atomic read/write of
   `~/.agent-lane/registry.json` (temp file + rename). Record: vmName, ownerPid,
   createdAt, expiresAt, plus provenance fields from ticket 006 (optional).
2. `create` registers before `limactl start`; successful `destroy` deregisters;
   exhausted retries keep the entry.
3. New CLI `src/reap.ts` + bin entry `agent-lane`: `agent-lane reap` lists
   registered entries, deletes only expired ones whose name passes
   `assertVmName`, via the same `destroy` routine; idempotent; never touches
   unregistered VMs.
4. Tests: register/deregister round-trip; atomic write; reap deletes only
   expired+validated; reap with corrupt registry skips bad entries and
   continues; concurrent writes do not corrupt.
5. `npm run check` green.

## Seams

- Registry is standalone; provider hooks are two calls in create/destroy.
