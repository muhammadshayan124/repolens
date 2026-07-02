import { generateText as anthropicGenerateText } from "./anthropic";
import { generateText as geminiGenerateText } from "./gemini";
import { generateText as openaiGenerateText } from "./openai";
import type { GenerateText, ProviderId } from "./types";

export const providerGenerators: Record<ProviderId, GenerateText> = {
  anthropic: anthropicGenerateText,
  openai: openaiGenerateText,
  gemini: geminiGenerateText,
};

export * from "./types";
