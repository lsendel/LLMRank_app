import OpenAI from "openai";
import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";

const REQUEST_TIMEOUT_MS = 30_000;

export async function checkGrok(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  // xAI uses an OpenAI-compatible API
  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });

  const response = await withRetry(() =>
    withTimeout(
      client.chat.completions.create({
        model: "grok-3-fast",
        messages: [{ role: "user", content: query }],
        max_tokens: 1024,
      }),
      REQUEST_TIMEOUT_MS,
    ),
  );

  const responseText = response.choices[0]?.message?.content ?? "";
  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "grok",
    query,
    responseText,
    ...analysis,
  };
}
