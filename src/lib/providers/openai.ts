import OpenAI from "openai";
import type { GenerateText } from "./types";

export const generateText: GenerateText = async (prompt, apiKey) => {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("GPT did not return a text response");
  }
  return text;
};
