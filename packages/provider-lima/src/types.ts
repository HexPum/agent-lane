import type { ExecResult, IsolatedSandboxProvider } from "@ai-hero/sandcastle";

export interface LimaProviderOptions {
  /** Lima template with Docker provisioned inside the guest. */
  readonly template?: string;
  readonly cpus?: number;
  readonly memoryGiB?: number;
  readonly diskGiB?: number;
  /** Hard lifetime bound applied through a host-side timer. */
  readonly timeoutMinutes?: number;
  /** Maximum number of bytes accepted from a single copyFileOut operation. */
  readonly maxCopyOutBytes?: number;
  /** Maximum number of live Lima VMs admitted by this provider instance. */
  readonly maxConcurrentVms?: number;
  /** Guest path populated by Sandcastle through copyIn. */
  readonly workspacePath?: string;
  /** Provider-level environment merged with Sandcastle's environment. */
  readonly env?: Readonly<Record<string, string>>;
  /** Test seam; production callers should not set this. */
  readonly runtime?: LimaRuntime;
}

export interface LimaRuntime {
  command(
    executable: string,
    args: readonly string[],
    options?: CommandOptions,
  ): Promise<ExecResult>;
  pipe(
    source: SpawnSpec,
    destination: SpawnSpec,
    onLine?: (line: string) => void,
  ): Promise<ExecResult>;
  capture(
    source: SpawnSpec,
    hostPath: string,
    maxBytes: number,
  ): Promise<ExecResult>;
}

export interface CommandOptions {
  readonly stdin?: string;
  readonly onLine?: (line: string) => void;
}

export interface SpawnSpec {
  readonly executable: string;
  readonly args: readonly string[];
}

/** Auditable inputs used to provision one lane. Stored on its registry record. */
export interface RunProvenance {
  readonly limaVersion: string;
  readonly templateSha256: string;
  readonly codexVersion: string;
  readonly claudeInstallerSha256: string;
}

export type LimaSandboxProvider = IsolatedSandboxProvider;
