# Ticket 006: pin and verify guest provisioning

Spec: item 5. ADR: 005. Blocked by: none. Tier: frontier.

## Problem

`curl -fsSL https://claude.ai/install.sh | bash` is unpinned and unverified.

## Work

1. In `templates/agent-lane.yaml` provision: download the installer to a temp
   file, verify SHA256 against a pinned hash constant, fail closed on mismatch,
   then execute. Pin the hash in the template with a comment on the bump
   process.
2. Record provenance per run: Lima version, template file SHA256, codex version
   (pinned 0.151.0), claude installer hash — written into the registry record
   (coordinate the field shape with ticket 005).
3. Tests: hash-verification helper unit tests (match passes, mismatch fails
   closed); provenance record shape.
4. `npm run check` green.

## Seams

- Template provision script + a small provenance helper; no lifecycle changes.
