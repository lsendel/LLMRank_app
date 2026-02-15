import type { RawVisibilityCheck } from "./data-aggregator";
import type { ReportCompetitor, GapQuery } from "./types";

export interface CompetitorAnalysis {
  competitors: ReportCompetitor[];
  gapQueries: GapQuery[];
}

/**
 * Aggregates competitor data from visibility checks.
 * Identifies competitors that get cited where user doesn't (gap queries).
 */
export function aggregateCompetitors(
  checks: RawVisibilityCheck[],
): CompetitorAnalysis | null {
  // Return null if no competitor data exists
  if (!checks.some((c) => c.competitorMentions?.length)) return null;

  // Build competitor map: domain -> { count, platforms, queries }
  const compMap = new Map<
    string,
    { count: number; platforms: Set<string>; queries: Set<string> }
  >();
  const gapQueries: GapQuery[] = [];

  for (const check of checks) {
    if (!check.competitorMentions) continue;

    const mentionedCompetitors: string[] = [];

    for (const comp of check.competitorMentions) {
      if (!comp.mentioned) continue;
      mentionedCompetitors.push(comp.domain);

      const existing = compMap.get(comp.domain) ?? {
        count: 0,
        platforms: new Set<string>(),
        queries: new Set<string>(),
      };
      existing.count++;
      existing.platforms.add(check.llmProvider);
      existing.queries.add(check.query);
      compMap.set(comp.domain, existing);
    }

    // Gap detection: competitors cited but user brand NOT mentioned
    if (!check.brandMentioned && mentionedCompetitors.length > 0) {
      gapQueries.push({
        query: check.query,
        platform: check.llmProvider,
        competitorsCited: mentionedCompetitors,
      });
    }
  }

  const competitors = Array.from(compMap.entries())
    .map(([domain, data]) => ({
      domain,
      mentionCount: data.count,
      platforms: Array.from(data.platforms),
      queries: Array.from(data.queries),
    }))
    .sort((a, b) => b.mentionCount - a.mentionCount);

  return { competitors, gapQueries };
}
