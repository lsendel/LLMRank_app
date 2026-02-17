import { describe, it, expect } from "vitest";
import { scoreLlmsTxt } from "../../dimensions/llms-txt";
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
      llmsTxtContent:
        "# Example Site\n> A great website\n## Docs\n- [API Reference](https://example.com/docs/api)",
    },
    ...overrides,
  };
}

describe("scoreLlmsTxt", () => {
  it("returns 100 for a page with a well-structured llms.txt", () => {
    const result = scoreLlmsTxt(makePage());
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  // --- MISSING_LLMS_TXT ---

  it("MISSING_LLMS_TXT: deducts 20 when hasLlmsTxt is false", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: false,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
      },
    });
    const result = scoreLlmsTxt(page);
    expect(result.score).toBe(80);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "MISSING_LLMS_TXT",
        severity: "critical",
      }),
    );
  });

  it("MISSING_LLMS_TXT: returns early (no further checks) when llms.txt missing", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: false,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        llmsTxtContent: "bad content",
      },
    });
    const result = scoreLlmsTxt(page);
    // Only one issue - MISSING_LLMS_TXT, not QUALITY too
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("MISSING_LLMS_TXT");
  });

  // --- LLMS_TXT_QUALITY ---

  it("LLMS_TXT_QUALITY: deducts 10 when llms.txt is missing 2+ key elements", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        llmsTxtContent: "Just some plain text with no structure at all",
      },
    });
    const result = scoreLlmsTxt(page);
    expect(result.score).toBe(90);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "LLMS_TXT_QUALITY",
        severity: "warning",
      }),
    );
  });

  it("LLMS_TXT_QUALITY: triggers when missing title, description, section, and link", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        llmsTxtContent: "No special formatting here",
      },
    });
    const result = scoreLlmsTxt(page);
    expect(result.issues.some((i) => i.code === "LLMS_TXT_QUALITY")).toBe(true);
  });

  // --- LLMS_TXT_INCOMPLETE ---

  it("LLMS_TXT_INCOMPLETE: deducts 5 when llms.txt is missing exactly 1 element", () => {
    // Has title, description, link, but no section heading (##)
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        llmsTxtContent:
          "# Example Site\n> A great website\n[Link](https://example.com)",
      },
    });
    const result = scoreLlmsTxt(page);
    expect(result.score).toBe(95);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "LLMS_TXT_INCOMPLETE",
        severity: "info",
      }),
    );
  });

  it("LLMS_TXT_INCOMPLETE: does not trigger when all 4 elements present", () => {
    // Default makePage already has all 4 elements
    const result = scoreLlmsTxt(makePage());
    expect(result.issues.some((i) => i.code === "LLMS_TXT_INCOMPLETE")).toBe(
      false,
    );
  });

  // --- Edge cases ---

  it("no deductions when siteContext is undefined", () => {
    const page = makePage({ siteContext: undefined });
    const result = scoreLlmsTxt(page);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("no deductions when hasLlmsTxt is true but no content provided", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        // no llmsTxtContent
      },
    });
    const result = scoreLlmsTxt(page);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("handles empty llms.txt content (missing all 4 elements)", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        llmsTxtContent: "",
      },
    });
    const result = scoreLlmsTxt(page);
    expect(result.score).toBe(90);
    expect(result.issues.some((i) => i.code === "LLMS_TXT_QUALITY")).toBe(true);
  });

  it("correctly identifies H1 vs H2 in title detection", () => {
    // Has ## heading but not # title
    const page = makePage({
      siteContext: {
        hasLlmsTxt: true,
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
        llmsTxtContent:
          "## Section\n> Description\n[Link](https://example.com)",
      },
    });
    const result = scoreLlmsTxt(page);
    // Missing title = 1 element missing => LLMS_TXT_INCOMPLETE
    expect(result.score).toBe(95);
    expect(result.issues.some((i) => i.code === "LLMS_TXT_INCOMPLETE")).toBe(
      true,
    );
  });
});
