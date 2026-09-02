import { describe, expect, it } from "vitest";

import { createRunProvenance, verifySha256 } from "../src/provenance.js";

describe("guest provisioning provenance", () => {
  it("accepts content that matches the pinned SHA256", () => {
    expect(() =>
      verifySha256(
        "abc",
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      ),
    ).not.toThrow();
  });

  it("fails closed when content does not match the pinned SHA256", () => {
    expect(() =>
      verifySha256(
        "tampered",
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      ),
    ).toThrow(
      "SHA256 mismatch: expected ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad, got d121be3103007b41edf96f8262925f8c7d61894afe9a041843b631f69445bc57",
    );
  });

  it("creates the registry provenance record for a run", () => {
    expect(
      createRunProvenance({
        limaVersion: "2.1.0",
        templateContents: `
          command -v codex || npm install --global @openai/codex@0.151.0
          CLAUDE_INSTALLER_SHA256="cde4f1702d3b1695f92b73d26888364e17bca476e17f0fd676484c951d36c125"
        `,
      }),
    ).toEqual({
      limaVersion: "2.1.0",
      templateSha256:
        "2f99f56d34632c4b87a0b7cabda36869241dc7d8bd4ddbd584b2dedeaba3a861",
      codexVersion: "0.151.0",
      claudeInstallerSha256:
        "cde4f1702d3b1695f92b73d26888364e17bca476e17f0fd676484c951d36c125",
    });
  });

  it("rejects a template without pinned provenance metadata", () => {
    expect(() =>
      createRunProvenance({
        limaVersion: "2.1.0",
        templateContents: "unpinned template",
      }),
    ).toThrow("Template must contain exactly one pinned Codex version");

    expect(() =>
      createRunProvenance({
        limaVersion: "2.1.0",
        templateContents: "npm install --global @openai/codex@0.151.0",
      }),
    ).toThrow(
      "Template must contain exactly one pinned Claude installer SHA256",
    );
  });

  it.each([
    {
      description: "Codex version",
      template: `
        npm install --global @openai/codex@0.151.0
        npm install --global @openai/codex@0.151.0
        CLAUDE_INSTALLER_SHA256="cde4f1702d3b1695f92b73d26888364e17bca476e17f0fd676484c951d36c125"
      `,
    },
    {
      description: "Claude installer SHA256",
      template: `
        npm install --global @openai/codex@0.151.0
        CLAUDE_INSTALLER_SHA256="cde4f1702d3b1695f92b73d26888364e17bca476e17f0fd676484c951d36c125"
        CLAUDE_INSTALLER_SHA256="cde4f1702d3b1695f92b73d26888364e17bca476e17f0fd676484c951d36c125"
      `,
    },
  ])("rejects duplicate $description pins", ({ description, template }) => {
    expect(() =>
      createRunProvenance({ limaVersion: "2.1.0", templateContents: template }),
    ).toThrow(`Template must contain exactly one pinned ${description}`);
  });
});
