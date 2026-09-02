import type { ExecResult, IsolatedSandboxProvider } from "@ai-hero/sandcastle";

import type { LaneRegistry } from "./registry.js";

export interface LimaProviderOptions {
  /** Lima template with Docker provisioned inside the guest. */
  readonly template?: string;
  readonly cpus?: number;
  readonly memoryGiB?: number;
  readonly diskGiB?: number;
  /** Hard lifetime bound applied through a host-side timer. */
  readonly timeoutMinutes?: number;
  /** Guest path populated by Sandcastle through copyIn. */
  readonly workspacePath?: string;
  /** Provider-level environment merged with Sandcastle's environment. */
  readonly env?: Readonly<Record<string, string>>;
  /** Test seam; production callers should not set this. */
  readonly runtime?: LimaRuntime;
  /** Test seam; production callers should use the persistent default registry. */
  readonly registry?: LaneRegistry;
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

export type LimaSandboxProvider = IsolatedSandboxProvider;
