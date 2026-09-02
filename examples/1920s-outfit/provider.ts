import { lima } from "@agent-lane/provider-lima";

export const sandbox = lima({
  cpus: 6,
  memoryGiB: 12,
  diskGiB: 30,
  timeoutMinutes: 90,
});

export const setupCommand = "npm ci";
export const testCommand =
  "python3 -m unittest discover -s tests -p 'test_*.py'";
