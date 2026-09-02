import { randomBytes } from "node:crypto";
import { lstat, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createIsolatedSandboxProvider } from "@ai-hero/sandcastle";
import type { ExecResult, IsolatedSandboxHandle } from "@ai-hero/sandcastle";

import { checkLimaVersion } from "./limaVersion.js";
import { nodeRuntime } from "./runtime.js";
import type { LimaProviderOptions, LimaRuntime } from "./types.js";
import {
  assertAbsoluteGuestPath,
  assertEnvironment,
  assertVmName,
  positiveInteger,
  shellQuote,
} from "./validation.js";

const DEFAULTS = {
  template: fileURLToPath(
    new URL("../templates/agent-lane.yaml", import.meta.url),
  ),
  cpus: 4,
  memoryGiB: 8,
  diskGiB: 30,
  timeoutMinutes: 60,
  maxCopyOutBytes: 256 * 1024 * 1024,
  maxConcurrentVms: 2,
  workspacePath: "/tmp/agent-lane/workspace",
} as const;

const CLEANUP_RETRY_DELAY_MS = 5_000;
const MAX_CLEANUP_RETRIES = 3;
const COPY_OUT_HELPER = [
  'const fs = require("node:fs");',
  "const source = process.argv[1];",
  "const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;",
  "const fd = fs.openSync(source, flags);",
  "const stat = fs.fstatSync(fd);",
  "if (!stat.isFile()) { fs.closeSync(fd); process.exit(65); }",
  "fs.createReadStream(null, { fd, autoClose: true }).pipe(process.stdout);",
].join(" ");

export function generateVmName(): string {
  return `agent-lane-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

function requireSuccess(result: ExecResult, action: string): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${action} failed with exit ${result.exitCode}: ${result.stderr || result.stdout}`,
    );
  }
}

function envFile(env: Readonly<Record<string, string>>): string {
  return Object.entries(env)
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join("\n");
}

async function destroy(runtime: LimaRuntime, name: string): Promise<void> {
  assertVmName(name);
  let stopFailure: unknown;
  try {
    const stopped = await runtime.command("limactl", ["stop", "--force", name]);
    if (stopped.exitCode !== 0) stopFailure = stopped;
  } catch (error) {
    stopFailure = error;
  }

  let deleted: ExecResult;
  try {
    deleted = await runtime.command("limactl", ["delete", "--force", name]);
  } catch (deleteFailure) {
    throw new AggregateError(
      stopFailure ? [stopFailure, deleteFailure] : [deleteFailure],
      `Failed to delete Lima VM ${name}`,
    );
  }
  if (deleted.exitCode !== 0) {
    const output = `${deleted.stderr}\n${deleted.stdout}`;
    if (!/does not exist|not found|no instance/i.test(output)) {
      throw new AggregateError(
        stopFailure ? [stopFailure, deleted] : [deleted],
        `Failed to delete Lima VM ${name}`,
      );
    }
  }
}

function guestShellArgs(name: string, script: string): string[] {
  assertVmName(name);
  return ["shell", name, "--", "bash", "-lc", script];
}

function createHandle(options: {
  name: string;
  workspacePath: string;
  envPath: string;
  runtime: LimaRuntime;
  timeoutMs: number;
  maxCopyOutBytes: number;
  onCloseSettled: () => void;
}): IsolatedSandboxHandle {
  let closePromise: Promise<void> | undefined;
  let cleanupFailures = 0;
  const {
    name,
    workspacePath,
    envPath,
    runtime,
    timeoutMs,
    maxCopyOutBytes,
    onCloseSettled,
  } = options;
  let timeout: ReturnType<typeof setTimeout>;

  const scheduleClose = (delayMs: number) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      void close().catch((error: unknown) => {
        console.error(`Agent Lane failed to expire Lima VM ${name}:`, error);
      });
    }, delayMs);
    timeout.unref();
  };

  const close = () => {
    if (!closePromise) {
      clearTimeout(timeout);
      const attempt = destroy(runtime, name);
      closePromise = attempt;
      void attempt.finally(onCloseSettled).catch(() => undefined);
      void attempt.then(
        () => {
          cleanupFailures = 0;
          clearTimeout(timeout);
        },
        () => {
          if (closePromise === attempt) closePromise = undefined;
          cleanupFailures += 1;
          if (cleanupFailures <= MAX_CLEANUP_RETRIES) {
            scheduleClose(CLEANUP_RETRY_DELAY_MS * cleanupFailures);
          }
        },
      );
    }
    return closePromise;
  };

  scheduleClose(timeoutMs);

  return {
    worktreePath: workspacePath,

    async exec(command, execOptions = {}) {
      const cwd = execOptions.cwd ?? workspacePath;
      assertAbsoluteGuestPath(cwd, "exec cwd");
      const elevated = execOptions.sudo
        ? `sudo --preserve-env -- bash -lc ${shellQuote(command)}`
        : command;
      const script =
        `export PATH="$HOME/.local/bin:$PATH"; ` +
        `set -a; source ${shellQuote(envPath)}; set +a; ` +
        `cd ${shellQuote(cwd)}; exec bash -lc ${shellQuote(elevated)}`;
      return runtime.command("limactl", guestShellArgs(name, script), {
        ...(execOptions.stdin === undefined
          ? {}
          : { stdin: execOptions.stdin }),
        ...(execOptions.onLine === undefined
          ? {}
          : { onLine: execOptions.onLine }),
      });
    },

    async copyIn(hostPath, sandboxPath) {
      assertAbsoluteGuestPath(sandboxPath, "copyIn destination");
      const parent = path.dirname(hostPath);
      const basename = path.basename(hostPath);
      const guestParent = path.posix.dirname(sandboxPath);
      const guestName = path.posix.basename(sandboxPath);
      const script =
        `mkdir -p ${shellQuote(guestParent)}; ` +
        `tmp=$(mktemp -d); tar -C "$tmp" -xf -; ` +
        `rm -rf ${shellQuote(sandboxPath)}; ` +
        `mv "$tmp"/${shellQuote(basename)} ${shellQuote(sandboxPath)}; ` +
        `rmdir "$tmp"`;
      const result = await runtime.pipe(
        {
          executable: "tar",
          args: ["-C", parent, "-cf", "-", "--", basename],
        },
        {
          executable: "limactl",
          args: guestShellArgs(name, script),
        },
      );
      requireSuccess(result, `Copy into ${guestName}`);
    },

    async copyFileOut(sandboxPath, hostPath) {
      assertAbsoluteGuestPath(sandboxPath, "copyFileOut source");
      const hostParent = path.dirname(hostPath);
      const guestName = path.posix.basename(sandboxPath);
      await mkdir(hostParent, { recursive: true });
      const temporaryDirectory = await mkdtemp(
        path.join(hostParent, ".agent-lane-copy-out-"),
      );
      try {
        const extracted = path.join(temporaryDirectory, guestName);
        const result = await runtime.capture(
          {
            executable: "limactl",
            args: guestShellArgs(
              name,
              `node -e ${shellQuote(COPY_OUT_HELPER)} ${shellQuote(sandboxPath)}`,
            ),
          },
          extracted,
          maxCopyOutBytes,
        );
        requireSuccess(result, `Copy out ${guestName}`);
        const stat = await lstat(extracted);
        if (!stat.isFile() || stat.isSymbolicLink()) {
          throw new Error(`Refusing non-regular copy-out source: ${guestName}`);
        }
        await rename(extracted, hostPath);
      } finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    },

    close,
  };
}

export function lima(options: LimaProviderOptions = {}) {
  const template = options.template ?? DEFAULTS.template;
  if (
    template !== DEFAULTS.template &&
    (!template.startsWith("template:") || /[\s\0]/.test(template))
  ) {
    throw new Error(
      "Custom Lima template must use a caller-trusted template:<name> locator",
    );
  }
  const cpus = positiveInteger(options.cpus ?? DEFAULTS.cpus, "cpus", 64);
  const memoryGiB = positiveInteger(
    options.memoryGiB ?? DEFAULTS.memoryGiB,
    "memoryGiB",
    256,
  );
  const diskGiB = positiveInteger(
    options.diskGiB ?? DEFAULTS.diskGiB,
    "diskGiB",
    2048,
  );
  const timeoutMinutes = positiveInteger(
    options.timeoutMinutes ?? DEFAULTS.timeoutMinutes,
    "timeoutMinutes",
    1440,
  );
  const maxCopyOutBytes = positiveInteger(
    options.maxCopyOutBytes ?? DEFAULTS.maxCopyOutBytes,
    "maxCopyOutBytes",
    4 * 1024 ** 3,
  );
  const maxConcurrentVms = positiveInteger(
    options.maxConcurrentVms ?? DEFAULTS.maxConcurrentVms,
    "maxConcurrentVms",
    32,
  );
  const workspacePath = options.workspacePath ?? DEFAULTS.workspacePath;
  assertAbsoluteGuestPath(workspacePath, "workspacePath");
  assertEnvironment(options.env ?? {});
  const runtime = options.runtime ?? nodeRuntime();
  let availableSlots = maxConcurrentVms;
  const queuedCreates: Array<() => void> = [];

  const acquireSlot = async (): Promise<() => void> => {
    if (availableSlots === 0) {
      await new Promise<void>((resolve) => queuedCreates.push(resolve));
    } else {
      availableSlots -= 1;
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = queuedCreates.shift();
      if (next) next();
      else availableSlots += 1;
    };
  };
  let limaVersionCheck: Promise<void> | undefined;

  return createIsolatedSandboxProvider({
    name: "lima",
    env: { ...options.env },
    async create({ env }) {
      assertEnvironment(env);
      const releaseSlot = await acquireSlot();
      limaVersionCheck ??= checkLimaVersion(runtime);
      await limaVersionCheck;
      const name = generateVmName();
      assertVmName(name);
      const envPath = "/tmp/agent-lane.env";
      try {
        const startResult = await runtime.command("limactl", [
          "start",
          `--name=${name}`,
          "--tty=false",
          "--mount-none",
          `--cpus=${cpus}`,
          `--memory=${memoryGiB}`,
          `--disk=${diskGiB}`,
          template,
        ]);
        requireSuccess(startResult, "Start Lima VM");
        const setup = await runtime.command(
          "limactl",
          guestShellArgs(
            name,
            `install -d -m 700 ${shellQuote(workspacePath)}; umask 077; cat > ${shellQuote(envPath)}`,
          ),
          { stdin: `${envFile(env)}\n` },
        );
        requireSuccess(setup, "Initialize guest workspace");

        return createHandle({
          name,
          workspacePath,
          envPath,
          runtime,
          timeoutMs: timeoutMinutes * 60_000,
          maxCopyOutBytes,
          onCloseSettled: releaseSlot,
        });
      } catch (error) {
        // `limactl start` can create an instance and still return non-zero.
        // Always target this generated name during rollback; destroy is
        // intentionally best-effort and never broadens to list/glob cleanup.
        await destroy(runtime, name).catch(() => undefined);
        releaseSlot();
        throw error;
      }
    },
  });
}
