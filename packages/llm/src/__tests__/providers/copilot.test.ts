import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock retry — bypass delays in tests
vi.mock("../../retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  withTimeout: (p: Promise<unknown>) => p,
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { checkCopilot } from "../../providers/copilot";

describe("checkCopilot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns visibility result from Bing search snippets", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          webPages: {
            value: [
              {
                name: "Example - Best AI SEO Tool",
                url: "https://example.com/features",
                snippet: "Example.com is the leading AI SEO platform...",
              },
              {
                name: "Other result",
                url: "https://other.com",
                snippet: "Some other content about SEO tools.",
              },
            ],
          },
        }),
    });

    const result = await checkCopilot(
      "best AI SEO tools",
      "example.com",
      ["rival.com"],
      "test-bing-key",
    );

    expect(result.provider).toBe("copilot");
    expect(result.brandMentioned).toBe(true);
    expect(result.urlCited).toBe(true);
    expect(result.query).toBe("best AI SEO tools");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.bing.microsoft.com"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Ocp-Apim-Subscription-Key": "test-bing-key",
        }),
      }),
    );
  });

  it("returns no mention when domain not in results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          webPages: {
            value: [
              {
                name: "Unrelated",
                url: "https://unrelated.com",
                snippet: "Nothing about the target domain.",
              },
            ],
          },
        }),
    });

    const result = await checkCopilot(
      "test query",
      "example.com",
      [],
      "test-key",
    );

    expect(result.brandMentioned).toBe(false);
    expect(result.urlCited).toBe(false);
  });

  it("handles empty webPages gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await checkCopilot("query", "example.com", [], "test-key");

    expect(result.provider).toBe("copilot");
    expect(result.responseText).toBe("");
    expect(result.brandMentioned).toBe(false);
  });

  it("handles API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    await expect(
      checkCopilot("test", "example.com", [], "bad-key"),
    ).rejects.toThrow("Bing API error: 403");
  });

  it("detects competitor mentions", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          webPages: {
            value: [
              {
                name: "acme.com review",
                url: "https://acme.com",
                snippet: "acme.com is great, also check rival.io",
              },
            ],
          },
        }),
    });

    const result = await checkCopilot(
      "comparison",
      "acme.com",
      ["rival.io", "absent.org"],
      "test-key",
    );

    expect(result.competitorMentions).toHaveLength(2);
    expect(result.competitorMentions[0].mentioned).toBe(true);
    expect(result.competitorMentions[1].mentioned).toBe(false);
  });
});
