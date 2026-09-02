import { createHash } from "node:crypto";

import type { RunProvenance } from "./types.js";

function sha256(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function requireSingleMatch(
  template: string,
  pattern: RegExp,
  description: string,
): string {
  const matches = [...template.matchAll(pattern)];
  if (matches.length !== 1 || !matches[0]?.[1]) {
    throw new Error(`Template must contain exactly one pinned ${description}`);
  }
  return matches[0][1];
}

export function verifySha256(
  content: string | Uint8Array,
  expectedSha256: string,
): void {
  const actualSha256 = sha256(content);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `SHA256 mismatch: expected ${expectedSha256}, got ${actualSha256}`,
    );
  }
}

export function createRunProvenance(options: {
  readonly limaVersion: string;
  readonly templateContents: string | Uint8Array;
}): RunProvenance {
  const template =
    typeof options.templateContents === "string"
      ? options.templateContents
      : Buffer.from(options.templateContents).toString("utf8");
  return {
    limaVersion: options.limaVersion,
    templateSha256: sha256(options.templateContents),
    codexVersion: requireSingleMatch(
      template,
      /@openai\/codex@(\d+\.\d+\.\d+)/g,
      "Codex version",
    ),
    claudeInstallerSha256: requireSingleMatch(
      template,
      /^\s*CLAUDE_INSTALLER_SHA256="([a-f0-9]{64})"\s*$/gm,
      "Claude installer SHA256",
    ),
  };
}
