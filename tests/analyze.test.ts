import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { analyzeRepo, buildPrompt } from "@/lib/analyze";
import type { RepoSnapshot } from "@/lib/github";

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

function fakeClient(responseText: string): Anthropic {
  return {
    messages: {
      create: async () => ({
        content: [{ type: "text", text: responseText }],
      }),
    },
  } as unknown as Anthropic;
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
    const client = fakeClient(JSON.stringify(validReport));
    const report = await analyzeRepo(baseSnapshot, client);
    expect(report).toEqual(validReport);
  });

  it("extracts JSON even when the model wraps it in prose", async () => {
    const client = fakeClient(`Here is the audit:\n${JSON.stringify(validReport)}\nHope that helps!`);
    const report = await analyzeRepo(baseSnapshot, client);
    expect(report.overallScore).toBe(8.5);
  });

  it("throws if the model response has no JSON", async () => {
    const client = fakeClient("Sorry, I can't help with that.");
    await expect(analyzeRepo(baseSnapshot, client)).rejects.toThrow();
  });

  it("throws if the JSON does not match the expected schema", async () => {
    const client = fakeClient(JSON.stringify({ foo: "bar" }));
    await expect(analyzeRepo(baseSnapshot, client)).rejects.toThrow();
  });
});
