import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { nodeRuntime } from "../src/runtime.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("node runtime", () => {
  it("streams stdout lines and retains stderr separately", async () => {
    const runtime = nodeRuntime();
    const lines: string[] = [];
    const result = await runtime.command(
      process.execPath,
      [
        "-e",
        "process.stdout.write('one\\n'); process.stderr.write('warning\\n'); setTimeout(() => process.stdout.write('two'), 20)",
      ],
      { onLine: (line) => lines.push(line) },
    );
    expect(result.exitCode).toBe(0);
    expect(lines).toEqual(["one", "two"]);
    expect(result.stdout).toBe("one\ntwo");
    expect(result.stderr).toBe("warning\n");
  });

  it("transfers stdin larger than the process argument limit", async () => {
    const runtime = nodeRuntime();
    const stdin = "x".repeat(140_000);
    const result = await runtime.command(
      process.execPath,
      [
        "-e",
        "let n=0; process.stdin.on('data', c => n += c.length); process.stdin.on('end', () => console.log(n))",
      ],
      { stdin },
    );
    expect(result.stdout.trim()).toBe("140000");
  });

  it("bounds retained untrusted output while still completing", async () => {
    const runtime = nodeRuntime();
    const result = await runtime.command(process.execPath, [
      "-e",
      "process.stdout.write('x'.repeat(20_000_000))",
    ]);
    expect(result.stdout.length).toBeLessThanOrEqual(64 * 1024);
    expect(result.exitCode).toBe(0);
  });

  it("captures binary stdout into an exclusive bounded file", async () => {
    const runtime = nodeRuntime();
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-lane-test-"));
    temporaryDirectories.push(directory);
    const output = path.join(directory, "output.bin");
    const result = await runtime.capture(
      {
        executable: process.execPath,
        args: ["-e", "process.stdout.write(Buffer.from([0,1,2,255]))"],
      },
      output,
      10,
    );
    expect(result.exitCode).toBe(0);
    expect([...new Uint8Array(await readFile(output))]).toEqual([0, 1, 2, 255]);
  });

  it("rejects capture beyond its byte limit", async () => {
    const runtime = nodeRuntime();
    const directory = await mkdtemp(path.join(os.tmpdir(), "agent-lane-test-"));
    temporaryDirectories.push(directory);
    await expect(
      runtime.capture(
        {
          executable: process.execPath,
          args: ["-e", "process.stdout.write('too large')"],
        },
        path.join(directory, "output.bin"),
        3,
      ),
    ).rejects.toThrow(/exceeds 3 bytes/);
  });
});
