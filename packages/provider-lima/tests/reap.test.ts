import type { ExecResult } from "@ai-hero/sandcastle";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { createRegistry } from "../src/registry.js";
import { isDirectExecution, reapExpired } from "../src/reap.js";
import type { CommandOptions, LimaRuntime, SpawnSpec } from "../src/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporaryRegistryPath(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "agent-lane-reap-test-"),
  );
  temporaryDirectories.push(directory);
  return path.join(directory, "state", "registry.json");
}

class FakeRuntime implements LimaRuntime {
  readonly commands: Array<{
    executable: string;
    args: readonly string[];
    options?: CommandOptions;
  }> = [];

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
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async pipe(_source: SpawnSpec, _destination: SpawnSpec): Promise<ExecResult> {
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async capture(): Promise<ExecResult> {
    return { stdout: "", stderr: "", exitCode: 0 };
  }
}

describe("expired lane reaper", () => {
  it("recognizes execution through an installed bin symlink", async () => {
    const registryPath = await temporaryRegistryPath();
    const modulePath = path.join(path.dirname(registryPath), "reap.js");
    const binPath = path.join(path.dirname(registryPath), "agent-lane");
    await mkdir(path.dirname(registryPath), { recursive: true });
    await writeFile(modulePath, "", "utf8");
    await symlink(modulePath, binPath);

    expect(
      await isDirectExecution(pathToFileURL(modulePath).href, binPath),
    ).toBe(true);
  });

  it("deletes only expired registered lanes and is idempotent", async () => {
    const registry = createRegistry(await temporaryRegistryPath());
    await registry.register({
      vmName: "agent-lane-expired",
      ownerPid: 101,
      createdAt: "2026-09-02T07:00:00.000Z",
      expiresAt: "2026-09-02T08:00:00.000Z",
    });
    await registry.register({
      vmName: "agent-lane-live",
      ownerPid: 102,
      createdAt: "2026-09-02T08:00:00.000Z",
      expiresAt: "2026-09-02T10:00:00.000Z",
    });
    const runtime = new FakeRuntime();

    const first = await reapExpired({
      registry,
      runtime,
      now: new Date("2026-09-02T09:00:00.000Z"),
    });
    const second = await reapExpired({
      registry,
      runtime,
      now: new Date("2026-09-02T09:00:00.000Z"),
    });

    expect(first).toEqual({
      registered: ["agent-lane-expired", "agent-lane-live"],
      reaped: ["agent-lane-expired"],
      failed: [],
    });
    expect(second).toEqual({
      registered: ["agent-lane-live"],
      reaped: [],
      failed: [],
    });
    expect(runtime.commands.map((call) => call.args)).toEqual([
      ["stop", "--force", "agent-lane-expired"],
      ["delete", "--force", "agent-lane-expired"],
    ]);
    expect((await registry.list()).map((entry) => entry.vmName)).toEqual([
      "agent-lane-live",
    ]);
  });

  it("skips corrupt and unsafe entries while continuing with valid ones", async () => {
    const registryPath = await temporaryRegistryPath();
    await mkdir(path.dirname(registryPath), { recursive: true });
    await writeFile(
      registryPath,
      JSON.stringify([
        null,
        { vmName: "agent-lane-missing-fields" },
        {
          vmName: "not-agent-lane",
          ownerPid: 201,
          createdAt: "2026-09-02T07:00:00.000Z",
          expiresAt: "2026-09-02T08:00:00.000Z",
        },
        {
          vmName: "agent-lane-valid",
          ownerPid: 202,
          createdAt: "2026-09-02T07:00:00.000Z",
          expiresAt: "2026-09-02T08:00:00.000Z",
        },
      ]),
      "utf8",
    );
    const registry = createRegistry(registryPath);
    const runtime = new FakeRuntime();

    const result = await reapExpired({
      registry,
      runtime,
      now: new Date("2026-09-02T09:00:00.000Z"),
    });

    expect(result).toEqual({
      registered: ["not-agent-lane", "agent-lane-valid"],
      reaped: ["agent-lane-valid"],
      failed: [],
    });
    expect(runtime.commands.map((call) => call.args.at(-1))).toEqual([
      "agent-lane-valid",
      "agent-lane-valid",
    ]);
  });

  it("keeps a failed entry and continues reaping later entries", async () => {
    const registry = createRegistry(await temporaryRegistryPath());
    for (const vmName of ["agent-lane-fails", "agent-lane-succeeds"]) {
      await registry.register({
        vmName,
        ownerPid: 301,
        createdAt: "2026-09-02T07:00:00.000Z",
        expiresAt: "2026-09-02T08:00:00.000Z",
      });
    }
    const runtime = new FakeRuntime();
    const originalCommand = runtime.command.bind(runtime);
    runtime.command = async (...args) => {
      const result = await originalCommand(...args);
      if (args[1][0] === "delete" && args[1].at(-1) === "agent-lane-fails") {
        return { stdout: "", stderr: "still exists", exitCode: 9 };
      }
      return result;
    };

    const result = await reapExpired({
      registry,
      runtime,
      now: new Date("2026-09-02T09:00:00.000Z"),
    });

    expect(result.reaped).toEqual(["agent-lane-succeeds"]);
    expect(result.failed).toEqual([
      {
        vmName: "agent-lane-fails",
        message: "Failed to delete Lima VM agent-lane-fails",
      },
    ]);
    expect((await registry.list()).map((entry) => entry.vmName)).toEqual([
      "agent-lane-fails",
    ]);
  });
});
