# Agent Lane contributor rules

Agent Lane is a security boundary. Treat fail-open behavior as a correctness
bug.

- Never add a host Docker socket mount.
- Never mount `$HOME`, SSH, cloud credentials, browser profiles, or agent state.
- Repository transfer must use explicit copy-in/copy-out, never a writable host
  bind mount.
- Every destructive lifecycle command must target a validated, generated VM
  name beginning with `agent-lane-`.
- Cleanup must be idempotent and run on partial startup failure.
- New configuration defaults must reduce authority, not expand it.
- Add tests for command construction and every safety rejection.
- Run `npm run check` before committing.
- Do not claim complete containment until the real-machine adversarial checks
  in `docs/POC.md` pass on each supported Lima/macOS version.
