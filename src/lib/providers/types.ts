export type ProviderId = "anthropic" | "openai" | "gemini";

export const PROVIDER_IDS: ProviderId[] = ["anthropic", "openai", "gemini"];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
  gemini: "Gemini (Google)",
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as string[]).includes(value);
}

/** Every provider module exports a single function with this shape: send the prompt,
 * return the raw text response. Analysis/parsing logic lives in analyze.ts and is shared
 * across providers -- this is the only part that differs per backend.
 */
export type GenerateText = (prompt: string, apiKey: string) => Promise<string>;
