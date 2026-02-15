import { describe, it, expect } from "vitest";
import { detectContentType } from "../domain/content-type";

describe("detectContentType", () => {
  it("detects blog posts via schema", () => {
    const result = detectContentType("https://example.com/blog/ai", [
      "BlogPosting",
    ]);
    expect(result.type).toBe("blog_post");
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it("detects docs from URL path", () => {
    const result = detectContentType(
      "https://example.com/docs/getting-started",
      [],
    );
    expect(result.type).toBe("documentation");
  });

  it("falls back to unknown when no signals", () => {
    const result = detectContentType("https://example.com/page", []);
    expect(result.type).toBe("unknown");
    expect(result.confidence).toBe(0);
  });
});
