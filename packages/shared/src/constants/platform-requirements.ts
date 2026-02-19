/**
 * Per-platform critical/important/recommended factor mapping.
 * Maps issue codes to importance levels for each AI platform.
 */

export interface PlatformCheck {
  factor: string;
  label: string;
  issueCode: string;
  importance: "critical" | "important" | "recommended";
}

export const PLATFORM_REQUIREMENTS: Record<string, PlatformCheck[]> = {
  ChatGPT: [
    {
      factor: "ai_crawlers",
      label: "GPTBot allowed",
      issueCode: "AI_CRAWLER_BLOCKED",
      importance: "critical",
    },
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "critical",
    },
    {
      factor: "llms_txt",
      label: "llms.txt file",
      issueCode: "MISSING_LLMS_TXT",
      importance: "important",
    },
    {
      factor: "direct_answers",
      label: "Direct answers",
      issueCode: "NO_DIRECT_ANSWERS",
      importance: "important",
    },
    {
      factor: "title",
      label: "Title tag",
      issueCode: "MISSING_TITLE",
      importance: "important",
    },
    {
      factor: "meta_desc",
      label: "Meta description",
      issueCode: "MISSING_META_DESC",
      importance: "recommended",
    },
    {
      factor: "sitemap",
      label: "Sitemap",
      issueCode: "MISSING_SITEMAP",
      importance: "recommended",
    },
    {
      factor: "citation",
      label: "Citation worthy",
      issueCode: "CITATION_WORTHINESS",
      importance: "important",
    },
  ],
  Claude: [
    {
      factor: "llms_txt",
      label: "llms.txt file",
      issueCode: "MISSING_LLMS_TXT",
      importance: "critical",
    },
    {
      factor: "ai_crawlers",
      label: "ClaudeBot allowed",
      issueCode: "AI_CRAWLER_BLOCKED",
      importance: "critical",
    },
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "important",
    },
    {
      factor: "content_depth",
      label: "Content depth",
      issueCode: "THIN_CONTENT",
      importance: "critical",
    },
    {
      factor: "direct_answers",
      label: "Direct answers",
      issueCode: "NO_DIRECT_ANSWERS",
      importance: "important",
    },
    {
      factor: "citation",
      label: "Citation worthy",
      issueCode: "CITATION_WORTHINESS",
      importance: "critical",
    },
    {
      factor: "summary",
      label: "Summary section",
      issueCode: "NO_SUMMARY_SECTION",
      importance: "recommended",
    },
    {
      factor: "faq",
      label: "FAQ structure",
      issueCode: "MISSING_FAQ_STRUCTURE",
      importance: "recommended",
    },
  ],
  Perplexity: [
    {
      factor: "ai_crawlers",
      label: "PerplexityBot allowed",
      issueCode: "AI_CRAWLER_BLOCKED",
      importance: "critical",
    },
    {
      factor: "citation",
      label: "Citation worthy",
      issueCode: "CITATION_WORTHINESS",
      importance: "critical",
    },
    {
      factor: "direct_answers",
      label: "Direct answers",
      issueCode: "NO_DIRECT_ANSWERS",
      importance: "critical",
    },
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "important",
    },
    {
      factor: "llms_txt",
      label: "llms.txt file",
      issueCode: "MISSING_LLMS_TXT",
      importance: "important",
    },
    {
      factor: "title",
      label: "Title tag",
      issueCode: "MISSING_TITLE",
      importance: "important",
    },
    {
      factor: "internal_links",
      label: "Internal links",
      issueCode: "NO_INTERNAL_LINKS",
      importance: "recommended",
    },
    {
      factor: "questions",
      label: "Question coverage",
      issueCode: "POOR_QUESTION_COVERAGE",
      importance: "important",
    },
  ],
  Copilot: [
    {
      factor: "meta_desc",
      label: "Meta description",
      issueCode: "MISSING_META_DESC",
      importance: "critical",
    },
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "critical",
    },
    {
      factor: "title",
      label: "Title tag",
      issueCode: "MISSING_TITLE",
      importance: "critical",
    },
    {
      factor: "sitemap",
      label: "Sitemap",
      issueCode: "MISSING_SITEMAP",
      importance: "important",
    },
    {
      factor: "canonical",
      label: "Canonical URL",
      issueCode: "MISSING_CANONICAL",
      importance: "important",
    },
    {
      factor: "robots",
      label: "Robots.txt",
      issueCode: "MISSING_ROBOTS_TXT",
      importance: "important",
    },
    {
      factor: "performance",
      label: "Page speed",
      issueCode: "SLOW_PAGE_LOAD",
      importance: "important",
    },
    {
      factor: "mobile",
      label: "Mobile friendly",
      issueCode: "NOT_MOBILE_FRIENDLY",
      importance: "recommended",
    },
  ],
  Grok: [
    {
      factor: "content_depth",
      label: "Content depth",
      issueCode: "THIN_CONTENT",
      importance: "critical",
    },
    {
      factor: "citation",
      label: "Citation worthy",
      issueCode: "CITATION_WORTHINESS",
      importance: "critical",
    },
    {
      factor: "direct_answers",
      label: "Direct answers",
      issueCode: "NO_DIRECT_ANSWERS",
      importance: "important",
    },
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "important",
    },
    {
      factor: "ai_crawlers",
      label: "AI crawlers allowed",
      issueCode: "AI_CRAWLER_BLOCKED",
      importance: "important",
    },
    {
      factor: "llms_txt",
      label: "llms.txt file",
      issueCode: "MISSING_LLMS_TXT",
      importance: "recommended",
    },
    {
      factor: "faq",
      label: "FAQ structure",
      issueCode: "MISSING_FAQ_STRUCTURE",
      importance: "recommended",
    },
    {
      factor: "freshness",
      label: "Content freshness",
      issueCode: "STALE_CONTENT",
      importance: "important",
    },
  ],
  Gemini: [
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "critical",
    },
    {
      factor: "ai_crawlers",
      label: "Google-Extended allowed",
      issueCode: "AI_CRAWLER_BLOCKED",
      importance: "critical",
    },
    {
      factor: "title",
      label: "Title tag",
      issueCode: "MISSING_TITLE",
      importance: "important",
    },
    {
      factor: "meta_desc",
      label: "Meta description",
      issueCode: "MISSING_META_DESC",
      importance: "important",
    },
    {
      factor: "sitemap",
      label: "Sitemap",
      issueCode: "MISSING_SITEMAP",
      importance: "important",
    },
    {
      factor: "canonical",
      label: "Canonical URL",
      issueCode: "MISSING_CANONICAL",
      importance: "important",
    },
    {
      factor: "llms_txt",
      label: "llms.txt file",
      issueCode: "MISSING_LLMS_TXT",
      importance: "recommended",
    },
    {
      factor: "entity_markup",
      label: "Entity markup",
      issueCode: "MISSING_ENTITY_MARKUP",
      importance: "recommended",
    },
  ],
  "Gemini AI Mode": [
    {
      factor: "structured_data",
      label: "JSON-LD schema",
      issueCode: "NO_STRUCTURED_DATA",
      importance: "critical",
    },
    {
      factor: "citation",
      label: "Citation worthy",
      issueCode: "CITATION_WORTHINESS",
      importance: "critical",
    },
    {
      factor: "ai_crawlers",
      label: "Google-Extended allowed",
      issueCode: "AI_CRAWLER_BLOCKED",
      importance: "critical",
    },
    {
      factor: "direct_answers",
      label: "Direct answers",
      issueCode: "NO_DIRECT_ANSWERS",
      importance: "important",
    },
    {
      factor: "llms_txt",
      label: "llms.txt file",
      issueCode: "MISSING_LLMS_TXT",
      importance: "important",
    },
    {
      factor: "entity_markup",
      label: "Entity markup",
      issueCode: "MISSING_ENTITY_MARKUP",
      importance: "important",
    },
    {
      factor: "summary",
      label: "Summary section",
      issueCode: "NO_SUMMARY_SECTION",
      importance: "recommended",
    },
    {
      factor: "internal_links",
      label: "Internal links",
      issueCode: "NO_INTERNAL_LINKS",
      importance: "recommended",
    },
  ],
};
