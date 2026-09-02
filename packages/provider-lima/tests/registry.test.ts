import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createRegistry } from "../src/registry.js";

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
    path.join(os.tmpdir(), "agent-lane-registry-test-"),
  );
  temporaryDirectories.push(directory);
  return path.join(directory, "state", "registry.json");
}

describe("persistent lane registry", () => {
  it("registers and deregisters a lane across registry instances", async () => {
    const registryPath = await temporaryRegistryPath();
    const entry = {
      vmName: "agent-lane-roundtrip",
      ownerPid: 1234,
      createdAt: "2026-09-02T08:00:00.000Z",
      expiresAt: "2026-09-02T09:00:00.000Z",
    };

    await createRegistry(registryPath).register(entry);
    expect(await createRegistry(registryPath).list()).toEqual([entry]);

    await createRegistry(registryPath).deregister(entry.vmName);
    expect(await createRegistry(registryPath).list()).toEqual([]);
  });

  it("does not lose entries during concurrent writes", async () => {
    const registryPath = await temporaryRegistryPath();
    const registry = createRegistry(registryPath);
    const entries = Array.from({ length: 24 }, (_, index) => ({
      vmName: `agent-lane-concurrent-${index}`,
      ownerPid: 2000 + index,
      createdAt: "2026-09-02T08:00:00.000Z",
      expiresAt: "2026-09-02T09:00:00.000Z",
    }));

    await Promise.all(entries.map((entry) => registry.register(entry)));

    expect(
      (await createRegistry(registryPath).list())
        .map((entry) => entry.vmName)
        .sort(),
    ).toEqual(entries.map((entry) => entry.vmName).sort());
  });

  it("recovers an abandoned lock without losing concurrent writes", async () => {
    const registryPath = await temporaryRegistryPath();
    await mkdir(path.dirname(registryPath), { recursive: true });
    await writeFile(
      `${registryPath}.lock`,
      JSON.stringify({ ownerPid: 2_147_483_647, token: "abandoned" }),
      "utf8",
    );
    const registry = createRegistry(registryPath);

    await Promise.all([
      registry.register({
        vmName: "agent-lane-after-crash-a",
        ownerPid: 1234,
        createdAt: "2026-09-02T08:00:00.000Z",
        expiresAt: "2026-09-02T09:00:00.000Z",
      }),
      registry.register({
        vmName: "agent-lane-after-crash-b",
        ownerPid: 1235,
        createdAt: "2026-09-02T08:00:00.000Z",
        expiresAt: "2026-09-02T09:00:00.000Z",
      }),
    ]);

    expect((await registry.list()).map((entry) => entry.vmName).sort()).toEqual(
      ["agent-lane-after-crash-a", "agent-lane-after-crash-b"],
    );
  });

  it("atomically replaces the registry path instead of following it", async () => {
    const registryPath = await temporaryRegistryPath();
    await mkdir(path.dirname(registryPath), { recursive: true });
    const sentinelPath = path.join(path.dirname(registryPath), "sentinel.txt");
    await writeFile(sentinelPath, "[]\n", "utf8");
    await symlink(sentinelPath, registryPath);

    await createRegistry(registryPath).register({
      vmName: "agent-lane-atomic",
      ownerPid: 1234,
      createdAt: "2026-09-02T08:00:00.000Z",
      expiresAt: "2026-09-02T09:00:00.000Z",
    });

    expect(await readFile(sentinelPath, "utf8")).toBe("[]\n");
    expect((await lstat(registryPath)).isSymbolicLink()).toBe(false);
    expect(await createRegistry(registryPath).list()).toHaveLength(1);
  });

  it("refuses to overwrite a wholly corrupt registry", async () => {
    const registryPath = await temporaryRegistryPath();
    await mkdir(path.dirname(registryPath), { recursive: true });
    await writeFile(registryPath, "not json\n", "utf8");

    await expect(
      createRegistry(registryPath).register({
        vmName: "agent-lane-new",
        ownerPid: 1234,
        createdAt: "2026-09-02T08:00:00.000Z",
        expiresAt: "2026-09-02T09:00:00.000Z",
      }),
    ).rejects.toThrow(/corrupt registry/i);
    await expect(createRegistry(registryPath).list()).rejects.toThrow(
      /corrupt registry/i,
    );
    expect(await readFile(registryPath, "utf8")).toBe("not json\n");
  });

  it("rejects a non-array registry document", async () => {
    const registryPath = await temporaryRegistryPath();
    await mkdir(path.dirname(registryPath), { recursive: true });
    await writeFile(registryPath, '{"entries":[]}\n', "utf8");
    const registry = createRegistry(registryPath);

    await expect(registry.list()).rejects.toThrow(/corrupt registry/i);
    await expect(registry.deregister("agent-lane-any")).rejects.toThrow(
      /corrupt registry/i,
    );
    expect(await readFile(registryPath, "utf8")).toBe('{"entries":[]}\n');
  });
});
