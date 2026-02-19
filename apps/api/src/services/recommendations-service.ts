export interface Recommendation {
  type: "gap" | "platform" | "issue" | "trend" | "coverage";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  provider?: string;
  fixUrl?: string;
}

interface GapData {
  query: string;
  competitorsCited: Array<{ domain: string }>;
}

interface PlatformFailure {
  platform: string;
  label: string;
  issueCode: string;
  importance: "critical" | "important" | "recommended";
}

interface TrendData {
  provider: string;
  currentRate: number;
  previousRate: number;
}

export function generateRecommendations(input: {
  gaps: GapData[];
  platformFailures: PlatformFailure[];
  issueCodesPresent: Set<string>;
  trends: TrendData[];
  providersUsed: Set<string>;
  projectId: string;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  // 1. Visibility gaps — queries where competitors are cited but user is not
  for (const gap of input.gaps.slice(0, 3)) {
    recs.push({
      type: "gap",
      title: `Invisible for "${gap.query}"`,
      description: `Competitors ${gap.competitorsCited.map((c) => c.domain).join(", ")} are cited for this query but you are not. Create targeted content addressing this topic.`,
      impact: "high",
      fixUrl: `/dashboard/projects/${input.projectId}?tab=strategy`,
    });
  }

  // 2. Platform readiness — critical checks failing
  const criticalFailures = input.platformFailures.filter(
    (f) => f.importance === "critical",
  );
  for (const failure of criticalFailures.slice(0, 3)) {
    const descriptions: Record<string, string> = {
      AI_CRAWLER_BLOCKED: `${failure.platform}'s crawler is blocked by your robots.txt. This prevents the AI from accessing your content entirely.`,
      NO_STRUCTURED_DATA: `Missing JSON-LD schema markup. ${failure.platform} uses structured data to understand and cite your content accurately.`,
      MISSING_LLMS_TXT: `No llms.txt file found. This file tells AI engines how to interpret and cite your content.`,
      THIN_CONTENT: `Content is too thin for ${failure.platform} to consider citation-worthy. Aim for 1500+ words with factual depth.`,
      CITATION_WORTHINESS: `Content lacks citation-worthy elements (statistics, original data, expert quotes) that ${failure.platform} looks for.`,
    };

    recs.push({
      type: "platform",
      title: `${failure.label} failing for ${failure.platform}`,
      description:
        descriptions[failure.issueCode] ??
        `Fix "${failure.label}" to improve ${failure.platform} visibility.`,
      impact: "high",
      provider: failure.platform.toLowerCase(),
      fixUrl: `/dashboard/projects/${input.projectId}?tab=issues`,
    });
  }

  // 3. SoV trend drops — providers where visibility is declining
  for (const trend of input.trends) {
    const drop = trend.previousRate - trend.currentRate;
    if (drop > 0.15) {
      recs.push({
        type: "trend",
        title: `${trend.provider} visibility dropped ${Math.round(drop * 100)}%`,
        description: `Your brand mention rate on ${trend.provider} fell from ${Math.round(trend.previousRate * 100)}% to ${Math.round(trend.currentRate * 100)}% this week. Review recent content changes and competitor activity.`,
        impact: drop > 0.3 ? "high" : "medium",
        provider: trend.provider,
      });
    }
  }

  // 4. Provider coverage gaps — providers not yet checked
  const allProviders = [
    "chatgpt",
    "claude",
    "perplexity",
    "gemini",
    "copilot",
    "gemini_ai_mode",
    "grok",
  ];
  const unchecked = allProviders.filter((p) => !input.providersUsed.has(p));
  if (unchecked.length > 0) {
    recs.push({
      type: "coverage",
      title: `Not tracking ${unchecked.length} AI provider${unchecked.length > 1 ? "s" : ""}`,
      description: `You haven't run visibility checks on ${unchecked.join(", ")}. Add these providers to get a complete picture.`,
      impact: unchecked.length >= 3 ? "medium" : "low",
    });
  }

  // Sort by impact (high first)
  const impactOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return recs.slice(0, 5);
}
