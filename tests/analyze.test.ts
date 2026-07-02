import { describe, expect, it } from "vitest";
import { analyzeRepo, buildPrompt } from "@/lib/analyze";
import type { RepoSnapshot } from "@/lib/github";
import type { GenerateText, ProviderId } from "@/lib/providers/types";

const baseSnapshot: RepoSnapshot = {
  owner: "owner",
  repo: "repo",
  description: "A test repo",
  stars: 3,
  defaultBranch: "main",
  topLevelFiles: ["README.md", "LICENSE"],
  hasReadme: true,
  readmeContent: "# repo\nSome docs",
  hasLicense: true,
  hasCiWorkflows: true,
  workflowFiles: ["ci.yml"],
  hasTestsDir: true,
  gitignoreContent: "node_modules\n.env",
  packageManifest: { name: "package.json", content: "{}" },
  suspiciousFiles: [],
};

function fakeGenerators(responseText: string): Record<ProviderId, GenerateText> {
  const generate: GenerateText = async () => responseText;
  return { anthropic: generate, openai: generate, gemini: generate };
}

describe("buildPrompt", () => {
  it("includes key repo signals in the prompt", () => {
    const prompt = buildPrompt(baseSnapshot);
    expect(prompt).toContain("owner/repo");
    expect(prompt).toContain("Has README: true");
    expect(prompt).toContain("Has LICENSE: true");
    expect(prompt).toContain("Some docs");
  });
});

describe("analyzeRepo", () => {
  const validReport = {
    overallScore: 8.5,
    headline: "Solid, well-documented repo",
    categories: [{ name: "Documentation", score: 9, summary: "Clear README" }],
    recommendations: ["Add more examples"],
    secretsFlag: false,
  };

  it("parses a valid JSON response from the model", async () => {
    const generators = fakeGenerators(JSON.stringify(validReport));
    const report = await analyzeRepo(baseSnapshot, "anthropic", "test-key", generators);
    expect(report).toEqual(validReport);
  });

  it("extracts JSON even when the model wraps it in prose", async () => {
    const generators = fakeGenerators(
      `Here is the audit:\n${JSON.stringify(validReport)}\nHope that helps!`
    );
    const report = await analyzeRepo(baseSnapshot, "openai", "test-key", generators);
    expect(report.overallScore).toBe(8.5);
  });

  it("dispatches to the requested provider only", async () => {
    let anthropicCalled = false;
    let geminiCalled = false;
    const generators: Record<ProviderId, GenerateText> = {
      anthropic: async () => {
        anthropicCalled = true;
        return JSON.stringify(validReport);
      },
      openai: async () => JSON.stringify(validReport),
      gemini: async () => {
        geminiCalled = true;
        return JSON.stringify(validReport);
      },
    };

    await analyzeRepo(baseSnapshot, "gemini", "test-key", generators);
    expect(geminiCalled).toBe(true);
    expect(anthropicCalled).toBe(false);
  });

  it("throws if the model response has no JSON", async () => {
    const generators = fakeGenerators("Sorry, I can't help with that.");
    await expect(
      analyzeRepo(baseSnapshot, "anthropic", "test-key", generators)
    ).rejects.toThrow();
  });

  it("throws if the JSON does not match the expected schema", async () => {
    const generators = fakeGenerators(JSON.stringify({ foo: "bar" }));
    await expect(
      analyzeRepo(baseSnapshot, "anthropic", "test-key", generators)
    ).rejects.toThrow();
  });
});
