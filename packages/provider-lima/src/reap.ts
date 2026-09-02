#!/usr/bin/env node

import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { destroy } from "./provider.js";
import { createRegistry } from "./registry.js";
import type { LaneRegistry } from "./registry.js";
import { nodeRuntime } from "./runtime.js";
import type { LimaRuntime } from "./types.js";
import { assertVmName } from "./validation.js";

export interface ReapResult {
  readonly registered: string[];
  readonly reaped: string[];
  readonly failed: Array<{ vmName: string; message: string }>;
}

export async function reapExpired(options: {
  registry: LaneRegistry;
  runtime: LimaRuntime;
  now?: Date;
}): Promise<ReapResult> {
  const entries = await options.registry.list();
  const registered = entries.map((entry) => entry.vmName);
  const reaped: string[] = [];
  const failed: Array<{ vmName: string; message: string }> = [];
  const now = (options.now ?? new Date()).getTime();

  for (const entry of entries) {
    if (Date.parse(entry.expiresAt) > now) continue;
    try {
      assertVmName(entry.vmName);
    } catch {
      continue;
    }
    try {
      await destroy(options.runtime, options.registry, entry.vmName);
      reaped.push(entry.vmName);
    } catch (error) {
      failed.push({
        vmName: entry.vmName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { registered, reaped, failed };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length !== 1 || argv[0] !== "reap") {
    console.error("Usage: agent-lane reap");
    return 64;
  }

  const result = await reapExpired({
    registry: createRegistry(),
    runtime: nodeRuntime(),
  });
  for (const vmName of result.registered) console.log(vmName);
  for (const failure of result.failed) {
    console.error(`Failed to reap ${failure.vmName}: ${failure.message}`);
  }
  return result.failed.length === 0 ? 0 : 1;
}

export async function isDirectExecution(
  moduleUrl: string,
  invokedPath: string,
): Promise<boolean> {
  try {
    return (
      (await realpath(fileURLToPath(moduleUrl))) ===
      (await realpath(invokedPath))
    );
  } catch {
    return false;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && (await isDirectExecution(import.meta.url, invokedPath))) {
  process.exitCode = await main();
}
