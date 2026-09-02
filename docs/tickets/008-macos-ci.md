# Ticket 008: Apple Silicon macOS CI job

Spec: item 8. Blocked by: 007. Model tier: unverified (flash-candidate).

## Problem
CI runs unit tests on Linux only; the real stack (lima + Apple Virtualization)
is never exercised in CI.

## Work
1. New `.github/workflows/ci-macos.yml`: `runs-on: macos-latest`, brew install
   lima, `npm ci`, `AGENT_LANE_INTEGRATION=1 npm test` (smoke subset first).
2. If Lima cannot start on the runner (virtualization limits), gate the job to
   `workflow_dispatch` and document the finding in the ticket's PR.
3. Keep the ubuntu job untouched.

## Seams
- New workflow file only.
