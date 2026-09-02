import { execFile } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const templatePath = fileURLToPath(
  new URL("../templates/agent-lane.yaml", import.meta.url),
);
const execFileAsync = promisify(execFile);
const installerFixture = "reviewed installer fixture";
const claudeInstallerSha256 =
  "cde4f1702d3b1695f92b73d26888364e17bca476e17f0fd676484c951d36c125";
const installerFixtureSha256 =
  "c0a94b5bed47109ed4ed37f8faa45746c046a7edd0ba24d5c7e072328e0179f0";

function userProvisionScript(template: string): string {
  const userProvision = template.indexOf("  - mode: user\n");
  const scriptMarker = "    script: |\n";
  const scriptStart = template.indexOf(scriptMarker, userProvision);
  const scriptEnd = template.indexOf("\nprobes:", scriptStart);
  if (userProvision === -1 || scriptStart === -1 || scriptEnd === -1) {
    throw new Error("Could not find the user provision script");
  }
  return template
    .slice(scriptStart + scriptMarker.length, scriptEnd)
    .replace(/^ {6}/gm, "");
}

async function writeExecutable(filePath: string, content: string) {
  await writeFile(filePath, content);
  await chmod(filePath, 0o700);
}

async function createProvisionHarness() {
  const directory = await mkdtemp(path.join(tmpdir(), "agent-lane-template-"));
  const binDirectory = path.join(directory, "bin");
  const downloadLog = path.join(directory, "download-path");
  const executionMarker = path.join(directory, "installer-executed");
  await mkdir(binDirectory);
  await writeExecutable(
    path.join(binDirectory, "curl"),
    `#!/bin/bash
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output" ]; then output="$2"; shift 2; else shift; fi
done
printf '%s' "${installerFixture}" > "$output"
printf '%s' "$output" > "$DOWNLOAD_LOG"
`,
  );
  await writeExecutable(
    path.join(binDirectory, "sha256sum"),
    `#!/bin/bash
read -r expected file
actual="$(/usr/bin/shasum -a 256 "$file" | /usr/bin/cut -d ' ' -f 1)"
[ "$actual" = "$expected" ]
`,
  );
  await writeExecutable(
    path.join(binDirectory, "bash"),
    `#!/bin/bash
touch "$EXECUTION_MARKER"
`,
  );
  return {
    directory,
    downloadLog,
    executionMarker,
    env: {
      ...process.env,
      DOWNLOAD_LOG: downloadLog,
      EXECUTION_MARKER: executionMarker,
      HOME: directory,
      PATH: `${binDirectory}:/usr/bin:/bin`,
    },
  };
}

async function expectAbsent(filePath: string) {
  await expect(access(filePath)).rejects.toMatchObject({ code: "ENOENT" });
}

describe("guest provision template", () => {
  it("verifies the pinned Claude installer before executing it", async () => {
    const template = await readFile(templatePath, "utf8");

    expect(template).toContain(
      `CLAUDE_INSTALLER_SHA256="${claudeInstallerSha256}"`,
    );
    expect(template).toContain("@openai/codex@0.151.0");
    expect(template).toContain('claude_installer="$(mktemp)"');
    expect(template).toContain(`trap 'rm -f "$claude_installer"' EXIT`);
    expect(template).toContain(
      'printf \'%s  %s\\n\' "$CLAUDE_INSTALLER_SHA256" "$claude_installer" | sha256sum --check --strict -',
    );

    const verifyPosition = template.indexOf("sha256sum --check --strict");
    const executePosition = template.indexOf('bash "$claude_installer"');
    expect(verifyPosition).toBeGreaterThan(-1);
    expect(executePosition).toBeGreaterThan(verifyPosition);
    expect(template).not.toContain(
      "curl -fsSL https://claude.ai/install.sh | bash",
    );
    expect(template).not.toContain(
      "command -v claude >/dev/null 2>&1 && exit 0",
    );
  });

  it("executes a matching installer and removes its temporary file", async () => {
    const harness = await createProvisionHarness();
    try {
      const template = await readFile(templatePath, "utf8");
      const script = userProvisionScript(template).replace(
        claudeInstallerSha256,
        installerFixtureSha256,
      );

      await execFileAsync("/bin/bash", ["-c", script], { env: harness.env });

      const downloadedPath = await readFile(harness.downloadLog, "utf8");
      await access(harness.executionMarker);
      await expectAbsent(downloadedPath);
    } finally {
      await rm(harness.directory, { recursive: true, force: true });
    }
  });

  it("does not execute a mismatched installer and still removes it", async () => {
    const harness = await createProvisionHarness();
    try {
      const template = await readFile(templatePath, "utf8");
      const script = userProvisionScript(template);

      await expect(
        execFileAsync("/bin/bash", ["-c", script], { env: harness.env }),
      ).rejects.toThrow();

      const downloadedPath = await readFile(harness.downloadLog, "utf8");
      await expectAbsent(harness.executionMarker);
      await expectAbsent(downloadedPath);
    } finally {
      await rm(harness.directory, { recursive: true, force: true });
    }
  });
});
