import { describe, it, expect } from "vitest";
import { calculatePlatformScores } from "../platforms";

const base = {
  technicalScore: 80,
  contentScore: 90,
  aiReadinessScore: 85,
  performanceScore: 75,
};

describe("calculatePlatformScores", () => {
  it("returns a score for every supported platform", () => {
    const result = calculatePlatformScores(base);
    expect(Object.keys(result)).toHaveLength(5);
    for (const [platform, detail] of Object.entries(result)) {
      expect(detail.score).toBeGreaterThanOrEqual(0);
      expect(detail.score).toBeLessThanOrEqual(100);
      expect(detail.grade).toMatch(/^[ABCDF]$/);
      expect(detail.tips.length).toBeGreaterThan(0);
      expect(platform).toBeDefined();
    }
  });

  it("clamps scores to 0-100", () => {
    const result = calculatePlatformScores({
      technicalScore: 0,
      contentScore: 0,
      aiReadinessScore: 0,
      performanceScore: 0,
    });
    for (const detail of Object.values(result)) {
      expect(detail.score).toBe(0);
      expect(detail.grade).toBe("F");
    }
  });
});
