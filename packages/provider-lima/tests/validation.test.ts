import { describe, expect, it } from "vitest";

import {
  assertAbsoluteGuestPath,
  assertEnvironment,
  assertVmName,
  positiveInteger,
  shellQuote,
} from "../src/validation.js";

describe("safety validation", () => {
  it("accepts only generated-scope VM names", () => {
    expect(() => assertVmName("agent-lane-abc-123")).not.toThrow();
    for (const unsafe of [
      "docker",
      "agent-lane-*",
      "agent-lane-../victim",
      "agent-lane-ABC",
      "agent-lane-",
    ]) {
      expect(() => assertVmName(unsafe)).toThrow(/unsafe Lima VM name/);
    }
  });

  it("rejects broad and relative guest paths", () => {
    for (const unsafe of ["workspace", "/", "/home", "/root", "../repo"]) {
      expect(() => assertAbsoluteGuestPath(unsafe, "path")).toThrow();
    }
    expect(() =>
      assertAbsoluteGuestPath("/home/agent/workspace", "path"),
    ).not.toThrow();
  });

  it("rejects environment names and values that could change shell syntax", () => {
    expect(() => assertEnvironment({ SAFE_TOKEN: "abc-123" })).not.toThrow();
    expect(() => assertEnvironment({ "BAD-NAME": "x" })).toThrow();
    expect(() => assertEnvironment({ SAFE: "first\nsecond" })).toThrow();
  });

  it("bounds resource values", () => {
    expect(positiveInteger(8, "cpus", 64)).toBe(8);
    for (const value of [0, -1, 1.5, 65, Number.NaN]) {
      expect(() => positiveInteger(value, "cpus", 64)).toThrow();
    }
  });

  it("single-quotes arbitrary shell text", () => {
    expect(shellQuote("a'b $HOME `id`")).toBe("'a'\"'\"'b $HOME `id`'");
  });
});
