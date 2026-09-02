# Real-machine proof of containment

Unit tests cannot prove VM containment. Run this checklist on every supported
macOS/Lima combination before release.

## Preconditions

- Use a clean test repository containing no real secrets.
- Record macOS, hardware, Lima, Node, Sandcastle, and Agent Lane versions.
- Start a harmless sentinel container in Docker Desktop. Never use a personal
  application container for this test.

## Required checks

1. Run `npm run check` and `npm pack --workspace @agent-lane/provider-lima
--dry-run`.
2. Start two lanes concurrently; verify unique VM names and independent files.
3. Inside each guest, verify the host repository, `$HOME`, `~/.ssh`,
   `~/.codex`, and `~/.claude` are absent.
4. Verify `/var/run/docker.sock`, if present, controls only the guest daemon.
   The Docker Desktop sentinel must not appear in `docker ps`.
5. Launch a Compose stack in the guest and verify the second lane and Docker
   Desktop cannot see or stop it.
6. Attempt to connect to known host-only loopback services; access must fail
   unless explicitly forwarded for the test.
7. Exercise `copyIn` with binary files, dotfiles, empty directories, executable
   files, and repository symlinks.
8. Exercise `copyFileOut` with binary files. Verify missing files, directories,
   and guest symlinks fail without modifying the host target.
9. Kill the agent during start, sync, command execution, and test execution.
   Verify the manifest reaper deletes only the corresponding VM.
10. Run past the configured lifetime and verify automatic deletion.
11. Make a commit plus an untracked file in the guest and verify Sandcastle
    returns only the expected patch/files.
12. Search reports, process arguments, Lima config, and logs for injected test
    credentials; none may appear.

## Pass record

Store a versioned report containing PASS/FAIL for each item, exact reproduction,
observed versus expected behavior, versions, and non-secret logs. A failed item
blocks claims of production hardening.
