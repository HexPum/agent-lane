# Architecture

## Scope

Agent Lane is a Sandcastle isolated sandbox provider, not a replacement for
Sandcastle. Sandcastle owns branches, worktrees, agent adapters, prompts,
iterations, and commit synchronization. Agent Lane owns the local VM boundary.

```text
trusted macOS host
  Sandcastle
    isolated-provider contract
      Agent Lane Lima provider
        disposable Linux VM
          copied repository worktree
          coding agent
          private Docker daemon
          project test stack
```

## Lifecycle

1. Sandcastle creates its task worktree on the host.
2. Agent Lane creates a uniquely named Lima VM using `template:docker` and
   `--mount-none`.
3. Agent Lane creates a private guest workspace and task-scoped environment
   file.
4. Sandcastle calls `copyIn` with its Git bundle and optional copy paths.
5. Sandcastle reconstructs the worktree inside the VM.
6. Agent commands and project tests run through `limactl shell`.
7. Sandcastle asks for individual patches and untracked files through
   `copyFileOut`; Agent Lane performs an atomic regular-file-only export.
8. `close` stops and deletes the exact VM name.

## Transfer model

`copyIn` uses a host-created tar stream and extracts it into a temporary guest
directory before moving it to the requested absolute destination. Git-managed
symlinks are allowed on input because the guest has no host filesystem mounts.

`copyFileOut` accepts regular files only. It rejects guest symlinks and streams
raw bytes into an exclusively created host temporary file with a 256 MiB
ceiling. It validates the result with `lstat` and atomically renames it over the
requested host destination. No guest-controlled archive is parsed on the host;
a failed or oversized transfer never replaces the destination.

## Sandcastle 0.12 lifecycle gap

Sandcastle currently acquires its automatic resource scope only after provider
creation and repository synchronization both succeed. If synchronization fails
after `create`, Sandcastle may not call the provider handle's `close` method.

Agent Lane limits the lifetime of every VM independently, so the VM is
eventually deleted while the creating Node process remains alive. That is not
enough for host-process crashes. Before the first production release, implement
both:

1. a persistent registry under the host's Agent Lane state directory with VM
   name, owner PID, creation time, and expiry;
2. `agent-lane reap`, which deletes only expired, prefix-validated registered
   VMs.

An upstream Sandcastle patch should also move resource acquisition immediately
after successful provider creation so synchronization occurs inside its release
scope.

## Version strategy

- Sandcastle compatibility is pinned to `>=0.12.0 <0.13.0`.
- Lima 2.x is the initial target because it provides `--mount-none` and current
  Apple Virtualization support.
- Guest template provenance must be recorded in each run manifest before a
  production release.
