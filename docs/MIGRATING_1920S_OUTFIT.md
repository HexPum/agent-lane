# Migrating `1920s-outfit`

The existing `.sandcastle` workflow remains the reference implementation for
plan validation, bounded execution, fixed test gates, result JSON, and
independent review. Migration changes only the runtime boundary.

## Keep

- `plan-contract.ts`, `validate-plan.ts`, and the task template;
- bounded implementation and repair iterations;
- host-controlled Python test gate;
- before/after reviewer test gate and dirty-worktree rejection;
- local logs/results and forensic preservation.

## Replace

```ts
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
```

with:

```ts
import { lima } from "@agent-lane/provider-lima";
```

and replace `docker({ imageName })` with an appropriate `lima({...})` profile.

Do not carry over the read-only host mount of `~/.codex/auth.json`. Supply a
short-lived task credential through the provider environment instead. Do not
copy `.sandcastle/.env` into the guest repository.

The Blender/CLO native-GUI lane remains outside the Linux VM and requires its
own macOS runner policy. Headless Python and repository tests belong in Agent
Lane.
