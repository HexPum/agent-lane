import type { LimaRuntime } from "./types.js";

const MINIMUM_LIMA_MAJOR = 2;

function unsupportedVersion(found: string): Error {
  return new Error(
    `agent-lane requires Lima 2.x or newer (found ${found}). brew upgrade lima`,
  );
}

export async function checkLimaVersion(runtime: LimaRuntime): Promise<void> {
  const result = await runtime.command("limactl", ["--version"]);
  const output = result.stdout.trim() || result.stderr.trim() || "unknown";
  const match = output.match(/\b(\d+)(?:\.\d+)+\b/);
  const major = match ? Number(match[1]) : Number.NaN;

  if (result.exitCode !== 0 || major < MINIMUM_LIMA_MAJOR || !match) {
    throw unsupportedVersion(match?.[0] ?? output);
  }
}
