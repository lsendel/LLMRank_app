import type { NarrativeInput } from "../types";
import type { NarrativeSectionType } from "@llm-boost/shared";

export function selectDataForSection(
  type: NarrativeSectionType,
  input: NarrativeInput,
): Record<string, unknown> {
  const base = {
    domain: input.crawlJob.domain,
    overallScore: input.crawlJob.overallScore,
    letterGrade: input.crawlJob.letterGrade,
    pagesScored: input.crawlJob.pagesScored,
  };

  switch (type) {
    case "executive_summary":
      return {
        ...base,
        categoryScores: input.categoryScores,
        topIssues: input.issues.slice(0, 5),
        quickWins: input.quickWins.slice(0, 3),
      };
    case "technical_analysis":
      return {
        ...base,
        technicalScore: input.categoryScores.technical,
        issues: input.issues.filter((i) => i.category === "technical"),
      };
    case "content_analysis":
      return {
        ...base,
        contentScore: input.categoryScores.content,
        contentHealth: input.contentHealth,
        issues: input.issues.filter((i) => i.category === "content"),
      };
    case "ai_readiness_analysis":
      return {
        ...base,
        aiReadinessScore: input.categoryScores.aiReadiness,
        issues: input.issues.filter((i) => i.category === "ai_readiness"),
      };
    case "performance_analysis":
      return {
        ...base,
        performanceScore: input.categoryScores.performance,
        issues: input.issues.filter((i) => i.category === "performance"),
      };
    case "trend_analysis":
      return {
        ...base,
        categoryScores: input.categoryScores,
        previousCrawl: input.previousCrawl,
      };
    case "competitive_positioning":
      return {
        ...base,
        competitors: input.competitors,
      };
    case "priority_recommendations":
      return {
        ...base,
        quickWins: input.quickWins,
        topIssues: input.issues
          .sort((a, b) => b.scoreImpact - a.scoreImpact)
          .slice(0, 10),
        topPages: input.pages.slice(0, 5),
        bottomPages: input.pages.slice(-5),
      };
    default:
      return base;
  }
}
