# Spec: agent-lane production ready

Destination: the Lima provider can be used for untrusted agent work on this
host without manual babysitting, and the POC checklist can claim containment.

## In scope

1. No lane can outlive its recorded expiry, even if the creating process
   crashes or cleanup retries are exhausted (ADR 001).
2. Elevated exec preserves the task environment (ADR 002).
3. Copy-out ceiling is configurable (ADR 003).
4. Concurrent lanes queue instead of exhausting the host (ADR 004).
5. Guest provisioning is pinned and provenance is recorded per run (ADR 005).
6. Unsupported Lima versions fail with a clear message (ADR 006).
7. An opt-in integration suite automates the automatable POC points.
8. CI exercises the real stack on an Apple Silicon macOS runner.

## Out of scope

- Upstream Sandcastle lifecycle patch (tracked separately).
- Pre-baked VM images (candidate for a later ADR).
- Linux hosts.

## Definition of done

All tickets pass review; `npm run check` green; integration suite green on this
host; POC checklist executed once end-to-end with a versioned pass record.
