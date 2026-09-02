import { lima } from "@agent-lane/provider-lima";

export const sandbox = lima({
  cpus: 8,
  memoryGiB: 16,
  diskGiB: 50,
  timeoutMinutes: 120,
});

export const setupCommand = "pnpm install --frozen-lockfile";
export const testCommand = "pnpm preflight";
