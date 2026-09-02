import type { ExecResult } from "@ai-hero/sandcastle";
import { describe, expect, it } from "vitest";

import { checkLimaVersion } from "../src/limaVersion.js";
import type { CommandOptions, LimaRuntime, SpawnSpec } from "../src/types.js";

function runtimeWithVersion(version: string): LimaRuntime {
  return {
    async command(
      _executable: string,
      _args: readonly string[],
      _options?: CommandOptions,
    ): Promise<ExecResult> {
      return { stdout: version, stderr: "", exitCode: 0 };
    },
    async pipe(
      _source: SpawnSpec,
      _destination: SpawnSpec,
    ): Promise<ExecResult> {
      throw new Error("not used");
    },
    async capture(): Promise<ExecResult> {
      throw new Error("not used");
    },
  };
}

describe("Lima version check", () => {
  it("accepts Lima 2.x", async () => {
    await expect(
      checkLimaVersion(runtimeWithVersion("limactl version 2.1.0")),
    ).resolves.toBeUndefined();
  });

  it("rejects Lima 1.x with upgrade guidance", async () => {
    await expect(
      checkLimaVersion(runtimeWithVersion("1.3.15")),
    ).rejects.toThrow(
      "agent-lane requires Lima 2.x or newer (found 1.3.15). brew upgrade lima",
    );
  });

  it("rejects an unparseable version with upgrade guidance", async () => {
    await expect(
      checkLimaVersion(runtimeWithVersion("garbage")),
    ).rejects.toThrow(
      "agent-lane requires Lima 2.x or newer (found garbage). brew upgrade lima",
    );
  });
});
