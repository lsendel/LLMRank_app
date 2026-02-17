import { describe, it, expect } from "vitest";
import { scoreRobotsCrawlability } from "../../dimensions/robots-crawlability";
import type { PageData } from "../../types";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example Site Here",
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine implementation here.",
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["Main Heading"],
      h2: ["Section 1"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: [],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://external.com"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Test",
        "og:description": "Desc",
        "og:image": "/img.png",
      },
      structured_data: [],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      sentence_length_variance: 20,
      top_transition_words: [],
    },
    lighthouse: null,
    llmScores: null,
    siteContext: {
      hasLlmsTxt: true,
      aiCrawlersBlocked: [],
      hasSitemap: true,
      contentHashes: new Map(),
    },
    ...overrides,
  };
}

describe("scoreRobotsCrawlability", () => {
  it("returns 100 for a clean page with no blocked crawlers and no noindex", () => {
    const result = scoreRobotsCrawlability(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- AI_CRAWLER_BLOCKED ---

  it("AI_CRAWLER_BLOCKED: deducts 25 when aiCrawlersBlocked has entries", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: ["GPTBot"],
        hasSitemap: true,
        contentHashes: new Map(),
      },
    });
    const result = scoreRobotsCrawlability(page);
    expect(result.score).toBe(75);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "AI_CRAWLER_BLOCKED",
        severity: "critical",
      }),
    );
  });

  it("AI_CRAWLER_BLOCKED: includes blocked crawler names in data", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: ["GPTBot", "ClaudeBot"],
        hasSitemap: true,
        contentHashes: new Map(),
      },
    });
    const result = scoreRobotsCrawlability(page);
    const issue = result.issues.find((i) => i.code === "AI_CRAWLER_BLOCKED");
    expect(issue?.data).toEqual({
      blockedCrawlers: ["GPTBot", "ClaudeBot"],
    });
  });

  it("AI_CRAWLER_BLOCKED: no deduction when aiCrawlersBlocked is empty", () => {
    const result = scoreRobotsCrawlability(makePage());
    const issue = result.issues.find((i) => i.code === "AI_CRAWLER_BLOCKED");
    expect(issue).toBeUndefined();
  });

  // --- NOINDEX_SET ---

  it("NOINDEX_SET: deducts 20 when noindex directive is present", () => {
    const page = makePage();
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"];
    const result = scoreRobotsCrawlability(page);
    expect(result.score).toBe(80);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "NOINDEX_SET",
        severity: "critical",
      }),
    );
  });

  it("NOINDEX_SET: no deduction when has_robots_meta is false", () => {
    const page = makePage();
    page.extracted.has_robots_meta = false;
    page.extracted.robots_directives = ["noindex"];
    const result = scoreRobotsCrawlability(page);
    const issue = result.issues.find((i) => i.code === "NOINDEX_SET");
    expect(issue).toBeUndefined();
  });

  it("NOINDEX_SET: no deduction for nofollow without noindex", () => {
    const page = makePage();
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["nofollow"];
    const result = scoreRobotsCrawlability(page);
    const issue = result.issues.find((i) => i.code === "NOINDEX_SET");
    expect(issue).toBeUndefined();
  });

  // --- Multiple issues ---

  it("accumulates both AI_CRAWLER_BLOCKED and NOINDEX_SET", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: ["GPTBot"],
        hasSitemap: true,
        contentHashes: new Map(),
      },
    });
    page.extracted.has_robots_meta = true;
    page.extracted.robots_directives = ["noindex"];
    const result = scoreRobotsCrawlability(page);
    // -25 (AI_CRAWLER_BLOCKED) + -20 (NOINDEX_SET) = 55
    expect(result.score).toBe(55);
    expect(result.issues).toHaveLength(2);
  });

  // --- Edge cases ---

  it("no deduction when siteContext is undefined", () => {
    const page = makePage({ siteContext: undefined });
    const result = scoreRobotsCrawlability(page);
    const issue = result.issues.find((i) => i.code === "AI_CRAWLER_BLOCKED");
    expect(issue).toBeUndefined();
  });
});
