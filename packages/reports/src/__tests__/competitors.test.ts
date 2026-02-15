import { describe, it, expect } from "vitest";
import { aggregateCompetitors } from "../competitors";
import type { RawVisibilityCheck } from "../data-aggregator";

function makeCheck(
  overrides: Partial<RawVisibilityCheck> = {},
): RawVisibilityCheck {
  return {
    llmProvider: "chatgpt",
    brandMentioned: true,
    urlCited: false,
    citationPosition: null,
    competitorMentions: null,
    query: "test query",
    ...overrides,
  };
}

describe("aggregateCompetitors", () => {
  it("returns null when no competitor mentions exist", () => {
    const checks = [makeCheck(), makeCheck({ llmProvider: "claude" })];
    expect(aggregateCompetitors(checks)).toBeNull();
  });

  it("returns null when competitorMentions arrays are empty", () => {
    const checks = [
      makeCheck({ competitorMentions: [] }),
      makeCheck({ competitorMentions: [] }),
    ];
    expect(aggregateCompetitors(checks)).toBeNull();
  });

  it("aggregates competitors sorted by mention count (descending)", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        competitorMentions: [
          { domain: "rival.com", mentioned: true },
          { domain: "other.com", mentioned: true },
        ],
        query: "query 1",
      }),
      makeCheck({
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "query 2",
      }),
      makeCheck({
        competitorMentions: [{ domain: "other.com", mentioned: true }],
        query: "query 3",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    expect(result!.competitors).toHaveLength(2);
    // rival.com has 2 mentions, other.com has 2 mentions
    expect(result!.competitors[0].domain).toBe("rival.com");
    expect(result!.competitors[0].mentionCount).toBe(2);
    expect(result!.competitors[1].domain).toBe("other.com");
    expect(result!.competitors[1].mentionCount).toBe(2);
  });

  it("detects gap queries where competitor is cited but brand is not mentioned", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        brandMentioned: false,
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "how to do X",
        llmProvider: "chatgpt",
      }),
      makeCheck({
        brandMentioned: true,
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "what is Y",
        llmProvider: "claude",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    expect(result!.gapQueries).toHaveLength(1);
    expect(result!.gapQueries[0]).toEqual({
      query: "how to do X",
      platform: "chatgpt",
      competitorsCited: ["rival.com"],
    });
  });

  it("does not create gap query when brand is mentioned even if competitors are cited", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        brandMentioned: true,
        competitorMentions: [
          { domain: "rival.com", mentioned: true },
          { domain: "other.com", mentioned: true },
        ],
        query: "best tools for Z",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    expect(result!.gapQueries).toHaveLength(0);
  });

  it("tracks platforms per competitor correctly", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        llmProvider: "chatgpt",
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "query A",
      }),
      makeCheck({
        llmProvider: "claude",
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "query B",
      }),
      makeCheck({
        llmProvider: "chatgpt",
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "query C",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    const rival = result!.competitors.find((c) => c.domain === "rival.com");
    expect(rival).toBeDefined();
    expect(rival!.platforms).toContain("chatgpt");
    expect(rival!.platforms).toContain("claude");
    expect(rival!.platforms).toHaveLength(2);
  });

  it("deduplicates queries for the same competitor", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        llmProvider: "chatgpt",
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "same query",
      }),
      makeCheck({
        llmProvider: "claude",
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "same query",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    const rival = result!.competitors.find((c) => c.domain === "rival.com");
    expect(rival!.queries).toHaveLength(1);
    expect(rival!.queries[0]).toBe("same query");
  });

  it("skips competitors with mentioned=false", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        competitorMentions: [
          { domain: "rival.com", mentioned: false },
          { domain: "other.com", mentioned: true },
        ],
        query: "test",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    expect(result!.competitors).toHaveLength(1);
    expect(result!.competitors[0].domain).toBe("other.com");
  });

  it("handles null brandMentioned as not mentioned for gap detection", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        brandMentioned: null,
        competitorMentions: [{ domain: "rival.com", mentioned: true }],
        query: "gap query",
        llmProvider: "perplexity",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    // null is falsy, so should produce a gap query
    expect(result!.gapQueries).toHaveLength(1);
    expect(result!.gapQueries[0].platform).toBe("perplexity");
  });

  it("includes multiple competitors in a single gap query", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        brandMentioned: false,
        competitorMentions: [
          { domain: "rival.com", mentioned: true },
          { domain: "other.com", mentioned: true },
          { domain: "skip.com", mentioned: false },
        ],
        query: "multi competitor query",
        llmProvider: "gemini",
      }),
    ];
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    expect(result!.gapQueries).toHaveLength(1);
    expect(result!.gapQueries[0].competitorsCited).toEqual([
      "rival.com",
      "other.com",
    ]);
  });

  it("returns empty arrays when competitors exist but none are mentioned", () => {
    const checks: RawVisibilityCheck[] = [
      makeCheck({
        competitorMentions: [
          { domain: "rival.com", mentioned: false },
          { domain: "other.com", mentioned: false },
        ],
        query: "test",
      }),
    ];
    // The check has competitorMentions with length > 0, so it passes the
    // initial .some() guard, but no competitor has mentioned=true
    const result = aggregateCompetitors(checks);
    expect(result).not.toBeNull();
    expect(result!.competitors).toHaveLength(0);
    expect(result!.gapQueries).toHaveLength(0);
  });
});
