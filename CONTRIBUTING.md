# Contributing

1. Open an issue describing the security or lifecycle change.
2. Work in a dedicated branch or worktree.
3. Include tests for success, partial failure, cleanup, and unsafe input.
4. Run `npm run check`.
5. Keep provider changes independent of project-specific profiles.

Changes that add host mounts, persistent credentials, unrestricted privileged
containers, or host Docker access will not be accepted.
