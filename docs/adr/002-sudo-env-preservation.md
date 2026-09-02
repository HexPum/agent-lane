# ADR 002: Preserve task environment under sudo

Status: accepted (2026-09-02)

## Context

`exec` with `sudo` loses the task environment because sudo resets it
(`env_reset`). Elevated commands silently run without Sandcastle's env.

## Decision

Elevated commands use `sudo --preserve-env -- bash -lc <command>`. The env file
is sourced before elevation, so `--preserve-env` carries it through.

## Consequences

- Elevated commands see the same task env as non-elevated ones.
- One unit test asserts the constructed script contains `--preserve-env`.
