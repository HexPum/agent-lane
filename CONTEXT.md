# Agent Lane — Domain Context

## Ubiquitous language

- **Lane**: One isolated execution run: a disposable Lima VM plus its handle.
- **Handle**: The `IsolatedSandboxHandle` Sandcastle uses: exec, copyIn, copyFileOut, close.
- **Registry**: Persistent host-side record of live lanes (VM name, owner PID, created, expiry) under `~/.agent-lane/registry.json`.
- **Reaper**: `agent-lane reap` CLI that deletes only expired, prefix-validated, registered VMs.
- **Boundary**: The security property agent-lane provides: no host mounts, no host Docker socket, explicit copy-in/copy-out only.
- **Run manifest**: Per-run provenance record (Lima version, template hash, agent versions).

## Hard rules (from AGENTS.md)

Fail-open behavior is a correctness bug. Never add host mounts. Cleanup must be
idempotent. New defaults must reduce authority. No containment claims before the
POC checklist passes on each supported Lima/macOS version.
