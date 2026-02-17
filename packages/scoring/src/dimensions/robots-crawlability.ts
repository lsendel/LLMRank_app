import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";

export function scoreRobotsCrawlability(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // AI_CRAWLER_BLOCKED: -25 if siteContext.aiCrawlersBlocked has entries
  if (page.siteContext && page.siteContext.aiCrawlersBlocked.length > 0) {
    deduct(s, "AI_CRAWLER_BLOCKED", {
      blockedCrawlers: page.siteContext.aiCrawlersBlocked,
    });
  }

  // NOINDEX_SET
  if (
    page.extracted.has_robots_meta &&
    page.extracted.robots_directives.includes("noindex")
  ) {
    deduct(s, "NOINDEX_SET");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
