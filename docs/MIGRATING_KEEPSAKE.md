# Migrating Keepsake

Keepsake is the primary nested-Docker validation profile.

## Guest requirements

- Node and the repository's pinned package manager;
- Docker Compose against the VM's private Docker daemon;
- enough disk and memory for the AIO and E2E images;
- no route or socket to Docker Desktop;
- dynamic ports scoped to the guest task.

## Suggested profile

```ts
lima({
  cpus: 8,
  memoryGiB: 16,
  diskGiB: 50,
  timeoutMinutes: 120,
});
```

Transfer a clean dedicated task branch. Run `pnpm install --frozen-lockfile`,
the targeted tests, and `pnpm preflight` inside the VM. Return commits and QA
reports through Sandcastle's isolated-provider synchronization; do not mount the
host worktree or `.claude/qa-reports` directory.

The existing per-run Compose project names and dynamic ports remain valuable
inside the VM because they isolate parallel tests from one another. VM
isolation additionally prevents any relationship with the user's Docker Desktop
project.
