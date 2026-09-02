import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createWriteStream } from "node:fs";
import type { Readable } from "node:stream";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { CommandOptions, LimaRuntime, SpawnSpec } from "./types.js";

interface CollectedProcess {
  readonly child: ChildProcessWithoutNullStreams;
  readonly stdout: BoundedBuffer;
  readonly stderr: BoundedBuffer;
}

const MAX_OUTPUT_TAIL_CHARS = 64 * 1024;

interface BoundedBuffer {
  chunks: string[];
  length: number;
}

function appendBounded(target: BoundedBuffer, value: string): void {
  target.chunks.push(value);
  target.length += value.length;
  while (target.length > MAX_OUTPUT_TAIL_CHARS && target.chunks.length > 1) {
    target.length -= target.chunks.shift()?.length ?? 0;
  }
  if (target.length > MAX_OUTPUT_TAIL_CHARS && target.chunks[0]) {
    target.chunks[0] = target.chunks[0].slice(-MAX_OUTPUT_TAIL_CHARS);
    target.length = target.chunks[0].length;
  }
}

function collectLines(
  stream: Readable,
  target: BoundedBuffer,
  onLine?: (line: string) => void,
): void {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk: string) => {
    pending += chunk;
    // A hostile process can emit an arbitrarily long line. Bound the
    // unfinished fragment as well as completed output so lack of a newline
    // cannot bypass the host-memory limit.
    if (pending.length > MAX_OUTPUT_TAIL_CHARS) {
      pending = pending.slice(-MAX_OUTPUT_TAIL_CHARS);
    }
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      appendBounded(target, `${line}\n`);
      onLine?.(line);
    }
  });
  stream.on("end", () => {
    if (pending) {
      appendBounded(target, pending);
      onLine?.(pending);
    }
  });
}

function start(
  spec: SpawnSpec,
  onLine?: (line: string) => void,
  collectStdout = true,
): CollectedProcess {
  const child = spawn(spec.executable, [...spec.args], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  });
  const stdout: BoundedBuffer = { chunks: [], length: 0 };
  const stderr: BoundedBuffer = { chunks: [], length: 0 };
  if (collectStdout) collectLines(child.stdout, stdout, onLine);
  collectLines(child.stderr, stderr);
  return { child, stdout, stderr };
}

function completion(process: CollectedProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    process.child.once("error", reject);
    process.child.once("close", (code, signal) => {
      if (signal) {
        reject(new Error(`Process terminated by ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export function nodeRuntime(): LimaRuntime {
  return {
    async command(executable, args, options: CommandOptions = {}) {
      const running = start({ executable, args }, options.onLine);
      if (options.stdin === undefined) {
        running.child.stdin.end();
      } else {
        running.child.stdin.end(options.stdin);
      }
      const exitCode = await completion(running);
      return {
        stdout: running.stdout.chunks.join(""),
        stderr: running.stderr.chunks.join(""),
        exitCode,
      };
    },

    async pipe(source, destination, onLine) {
      const sourceProcess = start(source, undefined, false);
      const destinationProcess = start(destination, onLine);
      sourceProcess.child.stdout.pipe(destinationProcess.child.stdin);
      sourceProcess.child.stdin.end();

      const [sourceExit, destinationExit] = await Promise.all([
        completion(sourceProcess),
        completion(destinationProcess),
      ]);
      const exitCode = sourceExit === 0 ? destinationExit : sourceExit;
      return {
        stdout: destinationProcess.stdout.chunks.join(""),
        stderr:
          sourceProcess.stderr.chunks.join("") +
          destinationProcess.stderr.chunks.join(""),
        exitCode,
      };
    },

    async capture(source, hostPath, maxBytes) {
      const sourceProcess = start(source, undefined, false);
      let transferred = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          transferred += chunk.length;
          if (transferred > maxBytes) {
            callback(new Error(`Copy-out exceeds ${maxBytes} bytes`));
            return;
          }
          callback(null, chunk);
        },
      });
      const output = createWriteStream(hostPath, { flags: "wx", mode: 0o600 });
      try {
        const [exitCode] = await Promise.all([
          completion(sourceProcess),
          pipeline(sourceProcess.child.stdout, limiter, output),
        ]);
        return {
          stdout: "",
          stderr: sourceProcess.stderr.chunks.join(""),
          exitCode,
        };
      } catch (error) {
        sourceProcess.child.kill("SIGKILL");
        throw error;
      }
    },
  };
}
