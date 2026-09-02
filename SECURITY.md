# Security policy and threat model

## Protected assets

Agent Lane is designed to keep an agent from reaching:

- files outside the repository snapshot supplied for its task;
- the host Docker daemon and unrelated containers;
- host credentials, browser profiles, SSH keys, and personal configuration;
- repositories or worktrees belonging to other tasks.

## Trust boundaries

The macOS process starting Agent Lane, Lima itself, Apple's virtualization
framework, and the selected guest image remain trusted. The coding agent,
generated shell commands, repository dependencies, package lifecycle scripts,
and containers launched inside the guest are untrusted.

Agent Lane does not make credentials safe after they are delivered to an
untrusted guest. A model token available inside the VM can be read and used by
guest processes. Use short-lived, task-scoped credentials and restricted
egress.

## Invariants

1. No host path is mounted writable into the guest.
2. The host Docker socket is never exposed.
3. Repository data crosses the boundary only through explicit transfer.
4. A task receives a new VM name and a fresh guest filesystem.
5. Close targets the exact task VM and may safely run multiple times.
6. A failure inside provider creation attempts cleanup before returning the
   original error.
7. The isolated-provider API exposes no host mount configuration.

## Known limitations

- The initial provider does not yet enforce host-service isolation or a
  domain-level egress allowlist. Lima user-mode networking is not a substitute
  for a firewall and outbound proxy policy.
- Credentials are stored in a mode-0600 file inside the disposable VM for its
  lifetime and sourced for commands. Guest processes invoked by the agent can
  read them.
- Sandcastle 0.12 can lose a successfully-created provider handle if its later
  repository synchronization fails. The provider's lifetime timer eventually
  deletes that VM, but immediate cleanup after a host crash requires the
  registry/reaper described in `docs/ARCHITECTURE.md`. Production enablement is
  blocked until that reaper or the corresponding upstream Sandcastle lifecycle
  fix is shipped.
- The preview guest template bootstraps NodeSource and Claude Code through
  upstream HTTPS installer scripts. Those moving installers are not immutable
  supply-chain inputs. A production template must pin downloaded artifacts and
  verify their digests, then record the resulting image provenance in the run
  manifest.
- A vulnerable Lima, virtualization framework, or guest/host transport could
  break the boundary.
- Resource limits reduce denial-of-service risk but do not eliminate it.
- Unit tests cover command and lifecycle behavior; `docs/POC.md` must pass
  before the runtime is described as production hardened.

## Reporting vulnerabilities

Do not open a public issue for an exploitable isolation bypass. Use GitHub's
private security advisory flow for this repository.
