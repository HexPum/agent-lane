import path from "node:path";

const VM_NAME_PATTERN = /^agent-lane-[a-z0-9][a-z0-9-]{0,50}$/;
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertVmName(name: string): void {
  if (!VM_NAME_PATTERN.test(name)) {
    throw new Error(`Refusing unsafe Lima VM name: ${JSON.stringify(name)}`);
  }
}

export function assertAbsoluteGuestPath(value: string, label: string): void {
  if (!path.posix.isAbsolute(value) || value.includes("\0")) {
    throw new Error(`${label} must be an absolute guest path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized === "/" || normalized === "/home" || normalized === "/root") {
    throw new Error(`${label} is too broad: ${value}`);
  }
}

export function assertEnvironment(env: Readonly<Record<string, string>>): void {
  for (const [key, value] of Object.entries(env)) {
    if (!ENV_NAME_PATTERN.test(key)) {
      throw new Error(
        `Invalid environment variable name: ${JSON.stringify(key)}`,
      );
    }
    if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
      throw new Error(
        `Environment variable ${key} contains unsupported control characters`,
      );
    }
  }
}

export function positiveInteger(
  value: number,
  label: string,
  max: number,
): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw new Error(`${label} must be an integer between 1 and ${max}`);
  }
  return value;
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}
