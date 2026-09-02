# `@agent-lane/provider-lima`

An isolated Sandcastle provider that creates one disposable Lima VM per run.

```ts
import { lima } from "@agent-lane/provider-lima";

const provider = lima({
  cpus: 8,
  memoryGiB: 16,
  diskGiB: 40,
  timeoutMinutes: 90,
});
```

The provider ships an Agent Lane template layered on Lima's `template:docker`.
It provisions Node 22, Claude Code, and Codex, while the provider enforces
`--mount-none`. Sandcastle copies the worktree into
`/tmp/agent-lane/workspace`; the host repository is never mounted in the guest.

The initial release targets Lima 2.x on Apple Silicon macOS. See the root
`SECURITY.md` and `docs/POC.md` before using it for untrusted work.

Every lane is recorded in `~/.agent-lane/registry.json` before Lima starts it.
Run the idempotent reaper periodically (for example, from cron) to remove
registered lanes after their expiry:

```bash
agent-lane reap
```

The command prints registered VM names and never discovers or deletes
unregistered Lima instances.
