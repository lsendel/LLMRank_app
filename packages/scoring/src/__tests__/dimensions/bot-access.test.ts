import { describe, it, expect } from "vitest";
import { scoreBotAccess } from "../../dimensions/bot-access";
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
      og_tags: {},
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

describe("scoreBotAccess", () => {
  it("returns 100 for a clean page", () => {
    const result = scoreBotAccess(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- HTTP_STATUS ---

  it("HTTP_STATUS: deducts 25 for 404 status", () => {
    const result = scoreBotAccess(makePage({ statusCode: 404 }));
    expect(result.score).toBe(75);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HTTP_STATUS", severity: "critical" }),
    );
  });

  it("HTTP_STATUS: deducts 25 for 500 status", () => {
    const result = scoreBotAccess(makePage({ statusCode: 500 }));
    expect(result.score).toBe(75);
  });

  it("HTTP_STATUS: no deduction for 200 status", () => {
    const result = scoreBotAccess(makePage({ statusCode: 200 }));
    const issue = result.issues.find((i) => i.code === "HTTP_STATUS");
    expect(issue).toBeUndefined();
  });

  it("HTTP_STATUS: no deduction for 301 redirect", () => {
    const result = scoreBotAccess(makePage({ statusCode: 301 }));
    const issue = result.issues.find((i) => i.code === "HTTP_STATUS");
    expect(issue).toBeUndefined();
  });

  it("HTTP_STATUS: deducts for exactly 400 status", () => {
    const result = scoreBotAccess(makePage({ statusCode: 400 }));
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "HTTP_STATUS" }),
    );
  });

  it("HTTP_STATUS: includes statusCode in data", () => {
    const result = scoreBotAccess(makePage({ statusCode: 403 }));
    const issue = result.issues.find((i) => i.code === "HTTP_STATUS");
    expect(issue?.data).toEqual({ statusCode: 403 });
  });

  // --- SLOW_RESPONSE ---

  it("SLOW_RESPONSE: deducts 10 for response time > 2000ms", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        responseTimeMs: 3000,
      },
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "SLOW_RESPONSE" }),
    );
  });

  it("SLOW_RESPONSE: no deduction for response time <= 2000ms", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        responseTimeMs: 1500,
      },
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "SLOW_RESPONSE");
    expect(issue).toBeUndefined();
  });

  it("SLOW_RESPONSE: no deduction when responseTimeMs is not set", () => {
    const result = scoreBotAccess(makePage());
    const issue = result.issues.find((i) => i.code === "SLOW_RESPONSE");
    expect(issue).toBeUndefined();
  });

  // --- REDIRECT_CHAIN ---

  it("REDIRECT_CHAIN: deducts 8 for 3+ redirect hops", () => {
    const page = makePage({
      redirectChain: [
        { url: "https://a.com", status_code: 301 },
        { url: "https://b.com", status_code: 302 },
        { url: "https://c.com", status_code: 301 },
      ],
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(92);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "REDIRECT_CHAIN" }),
    );
  });

  it("REDIRECT_CHAIN: no deduction for fewer than 3 hops", () => {
    const page = makePage({
      redirectChain: [
        { url: "https://a.com", status_code: 301 },
        { url: "https://b.com", status_code: 302 },
      ],
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "REDIRECT_CHAIN");
    expect(issue).toBeUndefined();
  });

  it("REDIRECT_CHAIN: includes hop count and chain in data", () => {
    const page = makePage({
      redirectChain: [
        { url: "https://a.com", status_code: 301 },
        { url: "https://b.com", status_code: 302 },
        { url: "https://c.com", status_code: 301 },
      ],
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "REDIRECT_CHAIN");
    expect(issue?.data).toEqual({
      hops: 3,
      chain: ["301 https://a.com", "302 https://b.com", "301 https://c.com"],
    });
  });

  // --- CORS_MIXED_CONTENT ---

  it("CORS_MIXED_CONTENT: deducts 5 when mixed content exists", () => {
    const page = makePage();
    page.extracted.cors_mixed_content = 3;
    const result = scoreBotAccess(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CORS_MIXED_CONTENT" }),
    );
  });

  it("CORS_MIXED_CONTENT: no deduction when 0", () => {
    const page = makePage();
    page.extracted.cors_mixed_content = 0;
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "CORS_MIXED_CONTENT");
    expect(issue).toBeUndefined();
  });

  // --- CORS_UNSAFE_LINKS ---

  it("CORS_UNSAFE_LINKS: deducts 3 when unsafe blank links exist", () => {
    const page = makePage();
    page.extracted.cors_unsafe_blank_links = 5;
    const result = scoreBotAccess(page);
    expect(result.score).toBe(97);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CORS_UNSAFE_LINKS", severity: "info" }),
    );
  });

  it("CORS_UNSAFE_LINKS: no deduction when 0", () => {
    const page = makePage();
    page.extracted.cors_unsafe_blank_links = 0;
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "CORS_UNSAFE_LINKS");
    expect(issue).toBeUndefined();
  });

  // --- LH_PERF_LOW ---

  it("LH_PERF_LOW: deducts 20 for lighthouse performance < 0.5", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.3,
        seo: 0.9,
        accessibility: 0.9,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_PERF_LOW" }),
    );
    // Should be -20 deduction
    expect(result.score).toBeLessThanOrEqual(80);
  });

  it("LH_PERF_LOW: deducts 10 for lighthouse performance 0.5-0.79", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.6,
        seo: 0.9,
        accessibility: 0.9,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_PERF_LOW" }),
    );
  });

  it("LH_PERF_LOW: no deduction for performance >= 0.8", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.85,
        seo: 0.9,
        accessibility: 0.9,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "LH_PERF_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LH_SEO_LOW ---

  it("LH_SEO_LOW: deducts 15 for lighthouse SEO < 0.8", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.9,
        seo: 0.5,
        accessibility: 0.9,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(85);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_SEO_LOW" }),
    );
  });

  it("LH_SEO_LOW: no deduction for SEO >= 0.8", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.9,
        seo: 0.85,
        accessibility: 0.9,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "LH_SEO_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LH_A11Y_LOW ---

  it("LH_A11Y_LOW: deducts 5 for lighthouse accessibility < 0.7", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.9,
        seo: 0.9,
        accessibility: 0.5,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_A11Y_LOW", severity: "info" }),
    );
  });

  it("LH_A11Y_LOW: no deduction for accessibility >= 0.7", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.9,
        seo: 0.9,
        accessibility: 0.75,
        best_practices: 0.9,
      },
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "LH_A11Y_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LH_BP_LOW ---

  it("LH_BP_LOW: deducts 5 for lighthouse best practices < 0.8", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.9,
        seo: 0.9,
        accessibility: 0.9,
        best_practices: 0.6,
      },
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LH_BP_LOW", severity: "info" }),
    );
  });

  it("LH_BP_LOW: no deduction for best practices >= 0.8", () => {
    const page = makePage({
      lighthouse: {
        performance: 0.9,
        seo: 0.9,
        accessibility: 0.9,
        best_practices: 0.85,
      },
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "LH_BP_LOW");
    expect(issue).toBeUndefined();
  });

  // --- LARGE_PAGE_SIZE ---

  it("LARGE_PAGE_SIZE: deducts 10 for page > 3MB", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        pageSizeBytes: 4 * 1024 * 1024, // 4MB
      },
    });
    const result = scoreBotAccess(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "LARGE_PAGE_SIZE" }),
    );
  });

  it("LARGE_PAGE_SIZE: no deduction for page <= 3MB", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        pageSizeBytes: 2 * 1024 * 1024, // 2MB
      },
    });
    const result = scoreBotAccess(page);
    const issue = result.issues.find((i) => i.code === "LARGE_PAGE_SIZE");
    expect(issue).toBeUndefined();
  });

  it("LARGE_PAGE_SIZE: no deduction when pageSizeBytes is not set", () => {
    const result = scoreBotAccess(makePage());
    const issue = result.issues.find((i) => i.code === "LARGE_PAGE_SIZE");
    expect(issue).toBeUndefined();
  });

  // --- Lighthouse null ---

  it("no lighthouse deductions when lighthouse is null", () => {
    const page = makePage({ lighthouse: null });
    const result = scoreBotAccess(page);
    const lhIssues = result.issues.filter((i) =>
      ["LH_PERF_LOW", "LH_SEO_LOW", "LH_A11Y_LOW", "LH_BP_LOW"].includes(
        i.code,
      ),
    );
    expect(lhIssues).toHaveLength(0);
  });

  // --- Multiple issues ---

  it("accumulates multiple bot access issues", () => {
    const page = makePage({
      statusCode: 500, // -25
      lighthouse: {
        performance: 0.3, // -20
        seo: 0.5, // -15
        accessibility: 0.5, // -5
        best_practices: 0.5, // -5
      },
    });
    const result = scoreBotAccess(page);
    // 100 - 25 - 20 - 15 - 5 - 5 = 30
    expect(result.score).toBe(30);
    expect(result.issues.length).toBeGreaterThanOrEqual(5);
  });

  it("score never goes below 0", () => {
    const page = makePage({
      statusCode: 500, // -25
      redirectChain: [
        { url: "https://a.com", status_code: 301 },
        { url: "https://b.com", status_code: 302 },
        { url: "https://c.com", status_code: 301 },
      ], // -8
      lighthouse: {
        performance: 0.2, // -20
        seo: 0.3, // -15
        accessibility: 0.3, // -5
        best_practices: 0.3, // -5
      },
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        responseTimeMs: 5000, // -10
        pageSizeBytes: 5 * 1024 * 1024, // -10
      },
    });
    page.extracted.cors_mixed_content = 5; // -5
    page.extracted.cors_unsafe_blank_links = 5; // -3
    const result = scoreBotAccess(page);
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
