import type { TokenUsage } from "../types";

// Approximate cost per 1M tokens (Anthropic pricing as of 2026)
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = COST_PER_1M[model] ?? COST_PER_1M["claude-sonnet-4-6"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return (inputCost + outputCost) * 100; // cents (unrounded for per-section tracking)
}

export function mergeTokenUsage(usages: TokenUsage[]): TokenUsage {
  const merged = usages.reduce(
    (acc, u) => ({
      input: acc.input + u.input,
      output: acc.output + u.output,
      costCents: acc.costCents + u.costCents,
    }),
    { input: 0, output: 0, costCents: 0 },
  );
  return { ...merged, costCents: Math.round(merged.costCents) };
}
