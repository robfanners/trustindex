// Provider-agnostic LLM wrapper. Currently uses Anthropic Claude.
// Switch provider by changing the implementation — callers stay the same.

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type LLMMessage = { role: "user" | "assistant"; content: string };

export async function generateText(
  systemPrompt: string,
  messages: LLMMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.3,
    system: systemPrompt,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}
