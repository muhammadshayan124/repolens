import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerateText } from "./types";

export const generateText: GenerateText = async (prompt, apiKey) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) {
    throw new Error("Gemini did not return a text response");
  }
  return text;
};
