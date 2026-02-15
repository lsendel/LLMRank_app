import { describe, it, expect } from "vitest";
import {
  LLM_PLATFORMS,
  LLM_PLATFORM_NAMES,
  PLATFORM_WEIGHTS,
  PLATFORM_TIPS,
} from "../../constants/platforms";

describe("LLM platform constants", () => {
  it("lists the supported platform identifiers", () => {
    expect(LLM_PLATFORMS).toEqual([
      "chatgpt",
      "perplexity",
      "claude",
      "gemini",
      "grok",
    ]);
  });

  it("provides metadata for each platform", () => {
    for (const id of LLM_PLATFORMS) {
      expect(LLM_PLATFORM_NAMES[id]).toBeDefined();
      const weights = PLATFORM_WEIGHTS[id];
      const total =
        weights.technical +
        weights.content +
        weights.ai_readiness +
        weights.performance;
      expect(Math.round(total * 100)).toBe(100);
      expect(PLATFORM_TIPS[id]).toBeDefined();
      expect(PLATFORM_TIPS[id].length).toBeGreaterThan(0);
    }
  });
});
