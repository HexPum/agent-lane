import type { ExecResult } from "@ai-hero/sandcastle";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandOptions, LimaRuntime, SpawnSpec } from "../src/types.js";

interface CapturedProviderConfig {
  name: string;
  env: Record<string, string>;
  create(options: { env: Record<string, string> }): Promise<{
    worktreePath: string;
    exec(
      command: string,
      options?: CommandOptions & { cwd?: string; sudo?: boolean },
    ): Promise<ExecResult>;
    copyFileOut(sandboxPath: string, hostPath: string): Promise<void>;
    close(): Promise<void>;
  }>;
}

vi.mock("@ai-hero/sandcastle", () => ({
  createIsolatedSandboxProvider: (config: CapturedProviderConfig) => config,
}));

const { generateVmName, lima } = await import("../src/provider.js");

class FakeRuntime implements LimaRuntime {
  readonly commands: Array<{
    executable: string;
    args: readonly string[];
    options?: CommandOptions;
  }> = [];
  readonly pipes: Array<{ source: SpawnSpec; destination: SpawnSpec }> = [];
  readonly captures: Array<{
    source: SpawnSpec;
    hostPath: string;
    maxBytes: number;
  }> = [];
  failCommand = -1;
  throwCommand = -1;

  async command(
    executable: string,
    args: readonly string[],
    options?: CommandOptions,
  ): Promise<ExecResult> {
    this.commands.push({
      executable,
      args,
      ...(options === undefined ? {} : { options }),
    });
    if (this.commands.length === this.throwCommand) {
      throw new Error("injected transport failure");
    }
    if (this.commands.length === this.failCommand) {
      return { stdout: "", stderr: "injected failure", exitCode: 9 };
    }
    return { stdout: "ok", stderr: "", exitCode: 0 };
  }

  async pipe(source: SpawnSpec, destination: SpawnSpec): Promise<ExecResult> {
    this.pipes.push({ source, destination });
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async capture(
    source: SpawnSpec,
    hostPath: string,
    maxBytes: number,
  ): Promise<ExecResult> {
    this.captures.push({ source, hostPath, maxBytes });
    await writeFile(hostPath, "captured");
    return { stdout: "", stderr: "", exitCode: 0 };
  }
}

function asCaptured(value: unknown): CapturedProviderConfig {
  return value as CapturedProviderConfig;
}

describe("lima provider lifecycle", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("generates unique deletion-safe VM names", () => {
    const names = new Set(Array.from({ length: 1_000 }, generateVmName));
    expect(names.size).toBe(1_000);
    for (const name of names) {
      expect(name).toMatch(/^agent-lane-[a-z0-9-]+$/);
      expect(name.length).toBeLessThanOrEqual(62);
    }
  });

  it("starts with no mounts and never puts secrets in start arguments", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime, cpus: 6, memoryGiB: 12 }));
    const handle = await provider.create({
      env: { API_TOKEN: "secret-value" },
    });

    const start = runtime.commands[0];
    expect(start?.executable).toBe("limactl");
    expect(start?.args).toContain("--mount-none");
    expect(start?.args).toContain("--cpus=6");
    expect(start?.args).toContain("--memory=12");
    expect(start?.args.join(" ")).not.toContain("secret-value");

    const setup = runtime.commands[1];
    expect(setup?.options?.stdin).toContain("API_TOKEN='secret-value'");
    expect(handle.worktreePath).toBe("/tmp/agent-lane/workspace");
    await handle.close();
  });

  it("preserves command text and stdin inside the guest shell invocation", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    const stdin = "x".repeat(140_000);
    const command = "printf '%s' \"$HOME `not-host`\"";
    await handle.exec(command, {
      cwd: "/home/agent/workspace with spaces",
      stdin,
    });

    const call = runtime.commands[2];
    expect(call?.executable).toBe("limactl");
    expect(call?.args.join(" ")).toContain("workspace with spaces");
    expect(call?.args.join(" ")).toContain("not-host");
    expect(call?.options?.stdin).toBe(stdin);
    await handle.close();
  });

  it("preserves the task environment for elevated commands", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: { TASK_TOKEN: "secret" } });

    await handle.exec("whoami", { sudo: true });

    expect(runtime.commands[2]?.args.join(" ")).toContain(
      "sudo --preserve-env --",
    );
    await handle.close();
  });

  it("limits copy-out to 256 MiB by default", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-lane-test-"));

    try {
      await handle.copyFileOut(
        "/tmp/artifact.bin",
        path.join(directory, "out.bin"),
      );
      expect(runtime.captures[0]?.maxBytes).toBe(268_435_456);
    } finally {
      await handle.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("applies a configured copy-out limit", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime, maxCopyOutBytes: 1_048_576 }));
    const handle = await provider.create({ env: {} });
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-lane-test-"));

    try {
      await handle.copyFileOut(
        "/tmp/artifact.bin",
        path.join(directory, "out.bin"),
      );
      expect(runtime.captures[0]?.maxBytes).toBe(1_048_576);
    } finally {
      await handle.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each([0, -1, 4_294_967_297])(
    "rejects invalid copy-out limit %s",
    (maxCopyOutBytes) => {
      expect(() => lima({ maxCopyOutBytes })).toThrow(
        "maxCopyOutBytes must be an integer between 1 and 4294967296",
      );
    },
  );

  it("rolls back its exact generated VM after partial creation failure", async () => {
    const runtime = new FakeRuntime();
    runtime.failCommand = 2;
    const provider = asCaptured(lima({ runtime }));
    await expect(provider.create({ env: {} })).rejects.toThrow(
      /Initialize guest workspace failed/,
    );

    const startName = runtime.commands[0]?.args
      .find((arg) => arg.startsWith("--name="))
      ?.slice("--name=".length);
    expect(startName).toMatch(/^agent-lane-/);
    expect(runtime.commands.at(-2)?.args).toEqual([
      "stop",
      "--force",
      startName,
    ]);
    expect(runtime.commands.at(-1)?.args).toEqual([
      "delete",
      "--force",
      startName,
    ]);
  });

  it("closes only its own VM and close is idempotent under concurrency", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    await Promise.all([handle.close(), handle.close(), handle.close()]);

    const destructive = runtime.commands.filter((call) =>
      ["stop", "delete"].includes(call.args[0] ?? ""),
    );
    expect(destructive).toHaveLength(2);
    const names = new Set(destructive.map((call) => call.args.at(-1)));
    expect(names.size).toBe(1);
    expect([...names][0]).toMatch(/^agent-lane-/);
  });

  it("attempts delete even when stop throws", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    runtime.throwCommand = 3;
    await handle.close();
    expect(runtime.commands[3]?.args[0]).toBe("delete");
  });

  it("rejects close when deletion cannot be confirmed", async () => {
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    runtime.failCommand = 4;
    await expect(handle.close()).rejects.toThrow(/Failed to delete Lima VM/);
    runtime.failCommand = -1;
    await expect(handle.close()).resolves.toBeUndefined();
    expect(runtime.commands.at(-1)?.args[0]).toBe("delete");
  });

  it("automatically retries a failed delete for the same VM", async () => {
    vi.useFakeTimers();
    const runtime = new FakeRuntime();
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    runtime.failCommand = 4;
    await expect(handle.close()).rejects.toThrow(/Failed to delete Lima VM/);

    runtime.failCommand = -1;
    await vi.advanceTimersByTimeAsync(5_000);

    const deletes = runtime.commands.filter(
      (call) => call.args[0] === "delete",
    );
    expect(deletes).toHaveLength(2);
    expect(new Set(deletes.map((call) => call.args.at(-1))).size).toBe(1);
    vi.useRealTimers();
  });

  it("treats an already absent VM as an idempotent successful close", async () => {
    const runtime = new FakeRuntime();
    const original = runtime.command.bind(runtime);
    runtime.command = async (...args) => {
      const result = await original(...args);
      if (runtime.commands.length === 4) {
        return { stdout: "", stderr: "instance does not exist", exitCode: 1 };
      }
      return result;
    };
    const provider = asCaptured(lima({ runtime }));
    const handle = await provider.create({ env: {} });
    await expect(handle.close()).resolves.toBeUndefined();
  });
});
