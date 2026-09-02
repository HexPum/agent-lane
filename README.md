# Agent Lane

Isolated execution lanes for coding agents.

Agent Lane is a project-neutral, local macOS runtime for
[Sandcastle](https://github.com/mattpocock/sandcastle). It runs each agent in
its own disposable [Lima](https://github.com/lima-vm/lima) Linux VM, transfers
the repository into the guest instead of bind-mounting it, and leaves Docker
workloads inside the guest's Docker daemon.

The project is intentionally small: Sandcastle remains responsible for agent,
branch, worktree, prompt, and commit orchestration. Agent Lane supplies the
missing local VM security boundary.

## Status

The provider is an implementation-stage preview with unit-tested lifecycle and
command construction. Real-machine validation remains a release blocker: run
[`docs/POC.md`](docs/POC.md) before using it for untrusted work.

## Security properties

- A fresh Lima VM is created for every sandbox handle.
- No host Docker socket, home directory, SSH directory, or agent state is
  mounted into the guest.
- Sandcastle copies its worktree into the VM through a tar stream.
- Commands execute only through `limactl shell` in the guest workspace.
- Files returned to Sandcastle use a size-bounded raw stream into an exclusive
  temporary file followed by an atomic rename.
- VM names are generated and validated by Agent Lane; teardown targets that
  exact name and is idempotent.
- Lanes are registered persistently before startup; `agent-lane reap` removes
  only expired, registered, name-validated VMs after owner crashes.
- The isolated provider exposes no host-mount option.
- VM resources and, while the host runner lives, lifetime are bounded by
  configuration.

See [`SECURITY.md`](SECURITY.md) for the threat model and important limits.

## Requirements

- macOS on Apple Silicon
- Node.js 22+
- [Lima](https://lima-vm.io/) (`brew install lima`)
- Sandcastle `0.12.x`

## Development

```bash
npm install
npm run check
```

## Usage

```ts
import { createSandbox, claudeCode } from "@ai-hero/sandcastle";
import { lima } from "@agent-lane/provider-lima";

await using sandbox = await createSandbox({
  branch: "agent/example",
  sandbox: lima({
    cpus: 8,
    memoryGiB: 16,
    diskGiB: 40,
    timeoutMinutes: 90,
  }),
});

await sandbox.run({
  agent: claudeCode("claude-sonnet-4-6"),
  prompt: "Follow the committed implementation plan.",
  maxIterations: 1,
});
```

Project-specific setup and test commands remain in the consuming repository.
Examples for Keepsake and `1920s-outfit` live under [`examples/`](examples/).

## Repository layout

```text
packages/provider-lima/  Sandcastle isolated-provider implementation
docs/                    architecture, PoC, and migration guides
examples/                thin project configuration examples
```

## Why not ordinary Docker?

A normal Sandcastle Docker provider bind-mounts a host worktree. That is useful
process isolation, but it is not host filesystem isolation. Mounting the host
Docker socket is even more dangerous because it grants control over host
containers. Agent Lane instead gives every run a VM and a Docker daemon that
has no relationship to Docker Desktop's daemon.

## License

Apache-2.0.
