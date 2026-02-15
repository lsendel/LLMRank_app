/**
 * LLM platform identifiers, display names, and research-based scoring weights.
 *
 * These values originated in the legacy Chrome extension and were validated
 * against the SaaS scoring categories. Each platform's weight array maps onto
 * our four scoring categories so we can project platform readiness without
 * recomputing every factor.
 */

export const LLM_PLATFORMS = [
  "chatgpt",
  "perplexity",
  "claude",
  "gemini",
  "grok",
] as const;

export type LLMPlatformId = (typeof LLM_PLATFORMS)[number];

export const LLM_PLATFORM_NAMES: Record<LLMPlatformId, string> = {
  chatgpt: "ChatGPT (OpenAI)",
  perplexity: "Perplexity",
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  grok: "Grok (xAI)",
};

export type PlatformCategoryWeights = Record<
  "technical" | "content" | "ai_readiness" | "performance",
  number
>;

export const PLATFORM_WEIGHTS: Record<LLMPlatformId, PlatformCategoryWeights> =
  {
    chatgpt: {
      technical: 0.1,
      content: 0.3,
      ai_readiness: 0.5,
      performance: 0.1,
    },
    perplexity: {
      technical: 0.25,
      content: 0.35,
      ai_readiness: 0.25,
      performance: 0.15,
    },
    claude: {
      technical: 0.18,
      content: 0.4,
      ai_readiness: 0.3,
      performance: 0.12,
    },
    gemini: {
      technical: 0.3,
      content: 0.25,
      ai_readiness: 0.3,
      performance: 0.15,
    },
    grok: {
      technical: 0.15,
      content: 0.4,
      ai_readiness: 0.25,
      performance: 0.2,
    },
  };

export const PLATFORM_TIPS: Record<LLMPlatformId, string[]> = {
  chatgpt: [
    "Use clear hierarchical heading structure (H1→H2→H3)",
    "Create comprehensive, in-depth content (2000+ words optimal)",
    "Include statistics and quotable facts for higher citation odds",
    "Reinforce brand/entity data with schema",
  ],
  perplexity: [
    "Expose publish/update dates so recency filters detect freshness",
    "Add current-year statistics and sources",
    "Implement schema markup (Article, FAQ) for trust",
    "Use answer-first formatting for quick extraction",
  ],
  claude: [
    "Use strong heading hierarchy with self-contained sections",
    "Maximize factual density with data-backed claims",
    "Link Article→Author→Organization in schema",
    "Break content into focused, scannable sections",
  ],
  gemini: [
    "Implement comprehensive JSON-LD schema (Article, FAQ, HowTo)",
    "Connect Author and Organization schema for E-E-A-T",
    "Use semantic HTML5 structure for sections",
    "Include E-E-A-T signals and cite reputable sources",
  ],
  grok: [
    "Reference current events and trending topics",
    "Include quotable statements and statistics",
    "Keep readability between 55-70 Flesch score",
    "Use schema markup to reinforce technical credibility",
  ],
};
