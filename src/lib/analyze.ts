import { z } from "zod";
import type { RepoSnapshot } from "./github";
import { providerGenerators, type GenerateText, type ProviderId } from "./providers";

const CategorySchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10),
  summary: z.string(),
});

export const AuditReportSchema = z.object({
  overallScore: z.number().min(0).max(10),
  headline: z.string(),
  categories: z.array(CategorySchema),
  recommendations: z.array(z.string()),
  secretsFlag: z.boolean(),
});

export type AuditReport = z.infer<typeof AuditReportSchema>;

export function buildPrompt(snapshot: RepoSnapshot): string {
  return `You are auditing a public GitHub repository for professional/portfolio quality signals.

Repository: ${snapshot.owner}/${snapshot.repo}
Description: ${snapshot.description ?? "(none)"}
Stars: ${snapshot.stars}
Top-level files: ${snapshot.topLevelFiles.join(", ") || "(none)"}
Has README: ${snapshot.hasReadme}
Has LICENSE: ${snapshot.hasLicense}
CI workflow files: ${snapshot.workflowFiles.join(", ") || "(none)"}
Has tests directory: ${snapshot.hasTestsDir}
.gitignore present: ${snapshot.gitignoreContent !== null}
.gitignore content: ${snapshot.gitignoreContent ?? "(none)"}
Dependency manifest found: ${snapshot.packageManifest?.name ?? "(none)"}
Suspicious top-level filenames (possible committed secrets): ${
    snapshot.suspiciousFiles.join(", ") || "(none)"
  }

README content (may be truncated):
${(snapshot.readmeContent ?? "(no README found)").slice(0, 4000)}

Score the repository 0-10 on each of these categories: Documentation, License & Legal,
CI/CD, Testing, Security Hygiene, Dependency Management. Set secretsFlag to true only if
there is a concrete signal of a leaked secret (a suspicious filename actually present in
the listing above) -- do not speculate beyond the evidence given.

Respond with ONLY valid JSON, no prose outside the JSON, matching exactly this shape:
{"overallScore": number, "headline": string, "categories": [{"name": string, "score": number, "summary": string}], "recommendations": string[], "secretsFlag": boolean}`;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Model response did not contain a JSON object");
  }
  return JSON.parse(match[0]);
}

export async function analyzeRepo(
  snapshot: RepoSnapshot,
  provider: ProviderId,
  apiKey: string,
  generators: Record<ProviderId, GenerateText> = providerGenerators
): Promise<AuditReport> {
  const generate = generators[provider];
  const prompt = buildPrompt(snapshot);
  const text = await generate(prompt, apiKey);
  return AuditReportSchema.parse(extractJson(text));
}
