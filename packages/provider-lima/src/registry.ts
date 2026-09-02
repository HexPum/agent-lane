import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface RegistryProvenance {
  readonly limaVersion?: string;
  readonly templateSha256?: string;
  readonly codexVersion?: string;
  readonly claudeInstallerSha256?: string;
}

export interface RegistryEntry {
  readonly vmName: string;
  readonly ownerPid: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly provenance?: RegistryProvenance;
}

export interface LaneRegistry {
  list(): Promise<RegistryEntry[]>;
  register(entry: RegistryEntry): Promise<void>;
  deregister(vmName: string): Promise<void>;
}

export function defaultRegistryPath(): string {
  return path.join(os.homedir(), ".agent-lane", "registry.json");
}

const LOCK_TIMEOUT_SECONDS = 10;
const LOCK_READY = "agent-lane-lock-ready\n";
const LOCK_HOLDER =
  `process.stdout.write(${JSON.stringify(LOCK_READY)});` +
  "process.stdin.resume();";
const inProcessLockTails = new Map<string, Promise<void>>();

function isErrno(error: unknown, code: string): boolean {
  return (error as NodeJS.ErrnoException).code === code;
}

async function withDarwinRegistryLock<T>(
  registryPath: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const lockPath = `${registryPath}.lock`;
  const holder = spawn(
    "/usr/bin/lockf",
    [
      "-t",
      String(LOCK_TIMEOUT_SECONDS),
      lockPath,
      process.execPath,
      "-e",
      LOCK_HOLDER,
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  holder.stdout.setEncoding("utf8");
  holder.stderr.setEncoding("utf8");
  let stderr = "";
  holder.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    holder.once("error", reject);
    holder.once("close", (code) => {
      reject(
        new Error(
          `Failed to acquire registry lock (${code ?? 1}): ${stderr.trim()}`,
        ),
      );
    });
    holder.stdout.once("data", (chunk: string) => {
      if (chunk === LOCK_READY) resolve();
      else
        reject(new Error("Registry lock holder returned an invalid response"));
    });
  });
  try {
    return await mutation();
  } finally {
    holder.stdin.end();
    await new Promise<void>((resolve, reject) => {
      holder.once("error", reject);
      holder.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Registry lock holder exited with ${code ?? 1}`));
      });
    });
  }
}

async function withInProcessRegistryLock<T>(
  registryPath: string,
  mutation: () => Promise<T>,
): Promise<T> {
  const previous = inProcessLockTails.get(registryPath) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const turn = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => turn);
  inProcessLockTails.set(registryPath, tail);
  await previous;
  try {
    return await mutation();
  } finally {
    release();
    void tail.then(() => {
      if (inProcessLockTails.get(registryPath) === tail) {
        inProcessLockTails.delete(registryPath);
      }
    });
  }
}

async function withRegistryLock<T>(
  registryPath: string,
  mutation: () => Promise<T>,
): Promise<T> {
  await mkdir(path.dirname(registryPath), { recursive: true, mode: 0o700 });
  return process.platform === "darwin"
    ? withDarwinRegistryLock(registryPath, mutation)
    : withInProcessRegistryLock(registryPath, mutation);
}

interface RegistrySnapshot {
  entries: RegistryEntry[];
  whollyCorrupt: boolean;
}

async function readSnapshot(registryPath: string): Promise<RegistrySnapshot> {
  let serialized: string;
  try {
    serialized = await readFile(registryPath, "utf8");
  } catch (error) {
    if (isErrno(error, "ENOENT")) {
      return { entries: [], whollyCorrupt: false };
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { entries: [], whollyCorrupt: true };
    }
    throw error;
  }
  if (!Array.isArray(parsed)) return { entries: [], whollyCorrupt: true };
  const entries = parsed.flatMap((value): RegistryEntry[] => {
    if (typeof value !== "object" || value === null) return [];
    const candidate = value as Partial<RegistryEntry>;
    if (
      typeof candidate.vmName !== "string" ||
      !Number.isSafeInteger(candidate.ownerPid) ||
      (candidate.ownerPid ?? 0) <= 0 ||
      typeof candidate.createdAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.createdAt)) ||
      typeof candidate.expiresAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.expiresAt))
    ) {
      return [];
    }
    return [candidate as RegistryEntry];
  });
  return { entries, whollyCorrupt: false };
}

async function readEntries(registryPath: string): Promise<RegistryEntry[]> {
  const snapshot = await readSnapshot(registryPath);
  if (snapshot.whollyCorrupt) {
    throw new Error(`Refusing to overwrite corrupt registry: ${registryPath}`);
  }
  return snapshot.entries;
}

async function writeEntries(
  registryPath: string,
  entries: readonly RegistryEntry[],
): Promise<void> {
  const directory = path.dirname(registryPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(registryPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, registryPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export function createRegistry(
  registryPath = defaultRegistryPath(),
): LaneRegistry {
  return {
    list: () => readEntries(registryPath),

    async register(entry) {
      await withRegistryLock(registryPath, async () => {
        const entries = await readEntries(registryPath);
        await writeEntries(registryPath, [
          ...entries.filter(({ vmName }) => vmName !== entry.vmName),
          entry,
        ]);
      });
    },

    async deregister(vmName) {
      await withRegistryLock(registryPath, async () => {
        const entries = await readEntries(registryPath);
        await writeEntries(
          registryPath,
          entries.filter((entry) => entry.vmName !== vmName),
        );
      });
    },
  };
}
