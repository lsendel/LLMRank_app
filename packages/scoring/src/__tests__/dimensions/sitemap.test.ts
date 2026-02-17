import { describe, it, expect } from "vitest";
import { scoreSitemap } from "../../dimensions/sitemap";
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

describe("scoreSitemap", () => {
  it("returns 100 for a page with a valid sitemap", () => {
    const result = scoreSitemap(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- MISSING_SITEMAP ---

  it("MISSING_SITEMAP: deducts 5 when hasSitemap is false", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: false,
        contentHashes: new Map(),
      },
    });
    const result = scoreSitemap(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_SITEMAP", severity: "info" }),
    );
  });

  it("MISSING_SITEMAP: no deduction when siteContext is undefined", () => {
    const page = makePage({ siteContext: undefined });
    const result = scoreSitemap(page);
    const issue = result.issues.find((i) => i.code === "MISSING_SITEMAP");
    expect(issue).toBeUndefined();
  });

  // --- SITEMAP_INVALID_FORMAT ---

  it("SITEMAP_INVALID_FORMAT: deducts 8 when sitemap exists but is not valid", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: false,
          urlCount: 5,
          staleUrlCount: 0,
          discoveredPageCount: 10,
        },
      },
    });
    const result = scoreSitemap(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "SITEMAP_INVALID_FORMAT",
        severity: "warning",
      }),
    );
  });

  it("SITEMAP_INVALID_FORMAT: no deduction when sitemap is valid", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: true,
          urlCount: 10,
          staleUrlCount: 0,
          discoveredPageCount: 10,
        },
      },
    });
    const result = scoreSitemap(page);
    const issue = result.issues.find(
      (i) => i.code === "SITEMAP_INVALID_FORMAT",
    );
    expect(issue).toBeUndefined();
  });

  it("SITEMAP_INVALID_FORMAT: no deduction when hasSitemap is false (skips analysis)", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: false,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: false,
          urlCount: 0,
          staleUrlCount: 0,
          discoveredPageCount: 0,
        },
      },
    });
    const result = scoreSitemap(page);
    const issue = result.issues.find(
      (i) => i.code === "SITEMAP_INVALID_FORMAT",
    );
    expect(issue).toBeUndefined();
  });

  // --- SITEMAP_STALE_URLS ---

  it("SITEMAP_STALE_URLS: deducts 3 when staleUrlCount > 0", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: true,
          urlCount: 20,
          staleUrlCount: 5,
          discoveredPageCount: 20,
        },
      },
    });
    const result = scoreSitemap(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "SITEMAP_STALE_URLS", severity: "info" }),
    );
    const issue = result.issues.find((i) => i.code === "SITEMAP_STALE_URLS");
    expect(issue?.data).toEqual({ staleUrlCount: 5, totalUrls: 20 });
  });

  it("SITEMAP_STALE_URLS: no deduction when staleUrlCount is 0", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: true,
          urlCount: 20,
          staleUrlCount: 0,
          discoveredPageCount: 20,
        },
      },
    });
    const result = scoreSitemap(page);
    const issue = result.issues.find((i) => i.code === "SITEMAP_STALE_URLS");
    expect(issue).toBeUndefined();
  });

  // --- SITEMAP_LOW_COVERAGE ---

  it("SITEMAP_LOW_COVERAGE: deducts 5 when coverage < 50%", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: true,
          urlCount: 4,
          staleUrlCount: 0,
          discoveredPageCount: 20,
        },
      },
    });
    const result = scoreSitemap(page);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "SITEMAP_LOW_COVERAGE",
        severity: "warning",
      }),
    );
    const issue = result.issues.find((i) => i.code === "SITEMAP_LOW_COVERAGE");
    expect(issue?.data).toEqual({
      sitemapUrls: 4,
      discoveredPages: 20,
      coverage: 20,
    });
  });

  it("SITEMAP_LOW_COVERAGE: no deduction when coverage >= 50%", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: true,
          urlCount: 10,
          staleUrlCount: 0,
          discoveredPageCount: 20,
        },
      },
    });
    const result = scoreSitemap(page);
    const issue = result.issues.find((i) => i.code === "SITEMAP_LOW_COVERAGE");
    expect(issue).toBeUndefined();
  });

  it("SITEMAP_LOW_COVERAGE: no deduction when discoveredPageCount is 0", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: true,
          urlCount: 0,
          staleUrlCount: 0,
          discoveredPageCount: 0,
        },
      },
    });
    const result = scoreSitemap(page);
    const issue = result.issues.find((i) => i.code === "SITEMAP_LOW_COVERAGE");
    expect(issue).toBeUndefined();
  });

  // --- Multiple issues ---

  it("accumulates all sitemap issues", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        sitemapAnalysis: {
          isValid: false,
          urlCount: 3,
          staleUrlCount: 2,
          discoveredPageCount: 20,
        },
      },
    });
    const result = scoreSitemap(page);
    // SITEMAP_INVALID_FORMAT (-8) + SITEMAP_STALE_URLS (-3) + SITEMAP_LOW_COVERAGE (-5) = -16
    expect(result.score).toBe(84);
    expect(result.issues).toHaveLength(3);
  });
});
