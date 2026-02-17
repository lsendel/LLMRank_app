import { describe, it, expect } from "vitest";
import { scorePageV2 } from "../engine-v2";
import type { PageData } from "../types";
import { DIMENSION_IDS, DEFAULT_DIMENSION_WEIGHTS } from "@llm-boost/shared";
import type { DimensionWeights } from "@llm-boost/shared";

function makePage(overrides: Partial<PageData> = {}): PageData {
  return {
    url: "https://example.com/test",
    statusCode: 200,
    title: "Test Page Title - Example Site Here", // 36 chars (within 30-60)
    metaDescription:
      "A valid meta description that is between 120 and 160 characters long for testing purposes and validation of the scoring engine implementation here.", // 148 chars
    canonicalUrl: "https://example.com/test",
    wordCount: 800,
    contentHash: "abc123",
    extracted: {
      h1: ["My Experience Testing This Product"],
      h2: ["Section 1", "Key Takeaways"],
      h3: [],
      h4: [],
      h5: [],
      h6: [],
      schema_types: ["Organization"],
      internal_links: ["/about", "/contact", "/blog"],
      external_links: ["https://example.edu/research"],
      images_without_alt: 0,
      has_robots_meta: false,
      robots_directives: [],
      og_tags: {
        "og:title": "Test",
        "og:description": "Desc",
        "og:image": "/img.png",
      },
      structured_data: [
        {
          "@type": "Organization",
          name: "Example Inc",
          url: "https://example.com",
        },
      ],
      pdf_links: [],
      cors_unsafe_blank_links: 0,
      cors_mixed_content: 0,
      cors_has_issues: false,
      flesch_score: 65,
      flesch_classification: "standard",
      text_html_ratio: 25,
      sentence_length_variance: 20,
      top_transition_words: ["however", "therefore"],
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

describe("scorePageV2 (engine-v2 integration)", () => {
  // --- 4xx/5xx pages ---

  it("returns all-zero scores for 404 pages", () => {
    const result = scorePageV2(makePage({ statusCode: 404 }));
    expect(result.overallScore).toBe(0);
    expect(result.letterGrade).toBe("F");
    expect(result.technicalScore).toBe(0);
    expect(result.contentScore).toBe(0);
    expect(result.aiReadinessScore).toBe(0);
    expect(result.performanceScore).toBe(0);
    for (const id of DIMENSION_IDS) {
      expect(result.dimensionScores[id]).toBe(0);
    }
  });

  it("returns all-zero scores for 500 pages", () => {
    const result = scorePageV2(makePage({ statusCode: 500 }));
    expect(result.overallScore).toBe(0);
    expect(result.letterGrade).toBe("F");
  });

  it("returns HTTP_STATUS issue for 4xx pages", () => {
    const result = scorePageV2(makePage({ statusCode: 403 }));
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].code).toBe("HTTP_STATUS");
    expect(result.issues[0].data).toEqual({ statusCode: 403 });
  });

  // --- Clean pages ---

  it("returns high scores for a clean, well-optimized page", () => {
    const result = scorePageV2(makePage());
    expect(result.overallScore).toBe(100);
    expect(result.letterGrade).toBe("A");
    expect(result.issues).toHaveLength(0);
  });

  it("all dimension scores are 100 for a clean page", () => {
    const result = scorePageV2(makePage());
    for (const id of DIMENSION_IDS) {
      expect(result.dimensionScores[id]).toBe(100);
    }
  });

  // --- Issues from different dimensions are merged ---

  it("merges issues from multiple dimensions", () => {
    const page = makePage({
      title: null, // meta_tags: MISSING_TITLE
      siteContext: {
        hasLlmsTxt: false, // llms_txt: MISSING_LLMS_TXT
        aiCrawlersBlocked: ["GPTBot"], // robots_crawlability: AI_CRAWLER_BLOCKED
        hasSitemap: false, // sitemap: MISSING_SITEMAP
        contentHashes: new Map(),
      },
    });
    const result = scorePageV2(page);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("MISSING_TITLE");
    expect(codes).toContain("MISSING_LLMS_TXT");
    expect(codes).toContain("AI_CRAWLER_BLOCKED");
    expect(codes).toContain("MISSING_SITEMAP");
  });

  it("sorts issues by severity: critical > warning > info", () => {
    const page = makePage({
      title: null, // critical MISSING_TITLE
      canonicalUrl: null, // warning MISSING_CANONICAL
    });
    page.extracted.og_tags = undefined; // info MISSING_OG_TAGS
    const result = scorePageV2(page);
    const severities = result.issues.map((i) => i.severity);

    // Verify ordering: all criticals come before warnings, warnings before infos
    let lastSeverityIndex = -1;
    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };
    for (const sev of severities) {
      const idx = severityOrder[sev];
      expect(idx).toBeGreaterThanOrEqual(lastSeverityIndex);
      lastSeverityIndex = idx;
    }
  });

  // --- Legacy fields are populated ---

  it("populates legacy technicalScore, contentScore, aiReadinessScore, performanceScore", () => {
    const result = scorePageV2(makePage());
    expect(typeof result.technicalScore).toBe("number");
    expect(typeof result.contentScore).toBe("number");
    expect(typeof result.aiReadinessScore).toBe("number");
    expect(typeof result.performanceScore).toBe("number");
    expect(result.technicalScore).toBeGreaterThanOrEqual(0);
    expect(result.technicalScore).toBeLessThanOrEqual(100);
    expect(result.contentScore).toBeGreaterThanOrEqual(0);
    expect(result.contentScore).toBeLessThanOrEqual(100);
    expect(result.aiReadinessScore).toBeGreaterThanOrEqual(0);
    expect(result.aiReadinessScore).toBeLessThanOrEqual(100);
    expect(result.performanceScore).toBeGreaterThanOrEqual(0);
    expect(result.performanceScore).toBeLessThanOrEqual(100);
  });

  it("legacy scores are derived from dimension scores", () => {
    const result = scorePageV2(makePage());
    const dims = result.dimensionScores;
    // technicalScore = avg(meta_tags, sitemap, robots_crawlability, bot_access)
    const expectedTechnical = Math.round(
      (dims.meta_tags +
        dims.sitemap +
        dims.robots_crawlability +
        dims.bot_access) /
        4,
    );
    expect(result.technicalScore).toBe(expectedTechnical);
    // contentScore = content_citeability
    expect(result.contentScore).toBe(Math.round(dims.content_citeability));
    // aiReadinessScore = avg(llms_txt, robots_crawlability, schema_markup)
    const expectedAI = Math.round(
      (dims.llms_txt + dims.robots_crawlability + dims.schema_markup) / 3,
    );
    expect(result.aiReadinessScore).toBe(expectedAI);
    // performanceScore = bot_access
    expect(result.performanceScore).toBe(Math.round(dims.bot_access));
  });

  // --- dimensionScores are populated ---

  it("has all 7 dimension IDs in dimensionScores", () => {
    const result = scorePageV2(makePage());
    for (const id of DIMENSION_IDS) {
      expect(result.dimensionScores).toHaveProperty(id);
      expect(typeof result.dimensionScores[id]).toBe("number");
    }
  });

  it("dimension scores are between 0 and 100", () => {
    const page = makePage({
      title: null,
      metaDescription: null,
      canonicalUrl: null,
    });
    const result = scorePageV2(page);
    for (const id of DIMENSION_IDS) {
      expect(result.dimensionScores[id]).toBeGreaterThanOrEqual(0);
      expect(result.dimensionScores[id]).toBeLessThanOrEqual(100);
    }
  });

  // --- Custom weights work ---

  it("custom weights affect overall score calculation", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: false, // llms_txt dimension gets -20
        aiCrawlersBlocked: [],
        hasSitemap: true,
        contentHashes: new Map(),
      },
    });

    // With default weights (llms_txt = 0.1): overall hit is ~2 points
    const defaultResult = scorePageV2(page);

    // With custom weights heavily weighting llms_txt
    const customWeights: DimensionWeights = {
      llms_txt: 0.9,
      robots_crawlability: 0.01,
      sitemap: 0.01,
      schema_markup: 0.01,
      meta_tags: 0.01,
      bot_access: 0.01,
      content_citeability: 0.05,
    };
    const customResult = scorePageV2(page, customWeights);

    // Custom result should be lower since llms_txt is weighted heavily and it's at 80
    expect(customResult.overallScore).toBeLessThan(defaultResult.overallScore);
  });

  it("custom weights are normalized to sum to 1.0", () => {
    // Even if weights don't sum to 1, they should produce valid results
    const customWeights: DimensionWeights = {
      llms_txt: 10,
      robots_crawlability: 10,
      sitemap: 10,
      schema_markup: 10,
      meta_tags: 10,
      bot_access: 10,
      content_citeability: 10,
    };
    const result = scorePageV2(makePage(), customWeights);
    // All dimensions are 100, so overall should be 100
    expect(result.overallScore).toBe(100);
  });

  // --- Letter grade thresholds ---

  it("assigns letter grade A for score >= 90", () => {
    const result = scorePageV2(makePage());
    expect(result.overallScore).toBeGreaterThanOrEqual(90);
    expect(result.letterGrade).toBe("A");
  });

  it("assigns letter grade F for 4xx pages", () => {
    const result = scorePageV2(makePage({ statusCode: 404 }));
    expect(result.letterGrade).toBe("F");
  });

  // --- Platform scores ---

  it("includes platformScores in the result", () => {
    const result = scorePageV2(makePage());
    expect(result.platformScores).toBeDefined();
    expect(typeof result.platformScores).toBe("object");
  });

  it("4xx pages have empty platformScores", () => {
    const result = scorePageV2(makePage({ statusCode: 404 }));
    expect(result.platformScores).toEqual({});
  });

  // --- Overall score is weighted average ---

  it("overall score is the weighted average of dimension scores", () => {
    const page = makePage({
      siteContext: {
        hasLlmsTxt: false, // llms_txt = 80
        aiCrawlersBlocked: [],
        hasSitemap: false, // sitemap = 95
        contentHashes: new Map(),
      },
    });
    const result = scorePageV2(page);

    // Manually compute expected overall
    const dims = result.dimensionScores;
    const w = DEFAULT_DIMENSION_WEIGHTS;
    const total = DIMENSION_IDS.reduce((sum, id) => sum + w[id], 0);
    const expected = Math.round(
      DIMENSION_IDS.reduce((sum, id) => sum + dims[id] * (w[id] / total), 0),
    );
    expect(result.overallScore).toBe(expected);
  });

  // --- Reduced dimension scenario ---

  it("correctly scores a page with issues in every dimension", () => {
    const page = makePage({
      title: null, // meta_tags
      statusCode: 200,
      siteContext: {
        hasLlmsTxt: false, // llms_txt
        aiCrawlersBlocked: ["GPTBot"], // robots_crawlability
        hasSitemap: false, // sitemap
        contentHashes: new Map(),
        responseTimeMs: 5000, // bot_access
      },
    });
    page.extracted.structured_data = []; // schema_markup: NO_STRUCTURED_DATA
    page.extracted.schema_types = [];
    page.extracted.h1 = []; // content_citeability: MISSING_H1
    page.extracted.internal_links = []; // content_citeability: NO_INTERNAL_LINKS
    const result = scorePageV2(page);

    // All dimensions should have deductions
    expect(result.dimensionScores.llms_txt).toBeLessThan(100);
    expect(result.dimensionScores.robots_crawlability).toBeLessThan(100);
    expect(result.dimensionScores.sitemap).toBeLessThan(100);
    expect(result.dimensionScores.schema_markup).toBeLessThan(100);
    expect(result.dimensionScores.meta_tags).toBeLessThan(100);
    expect(result.dimensionScores.bot_access).toBeLessThan(100);
    expect(result.dimensionScores.content_citeability).toBeLessThan(100);

    // Overall should be significantly reduced
    expect(result.overallScore).toBeLessThan(90);
    expect(result.issues.length).toBeGreaterThanOrEqual(7);
  });
});
