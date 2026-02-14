import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const CLARITY_API = "https://www.clarity.ms/api/v1";

export async function fetchClarityData(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { pageUrls, credentials, config } = ctx;
  const { apiKey } = credentials;
  const projectId = (config.projectId as string) ?? credentials.projectId;

  if (!projectId) {
    throw new Error("Clarity project ID is required");
  }

  // Fetch page-level heatmap/engagement data
  const res = await fetch(
    `${CLARITY_API}/projects/${projectId}/pages?days=28`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Clarity API error: ${res.status}`);
  }

  const clarityData: {
    pages?: {
      url: string;
      deadClicks: number;
      rageClicks: number;
      scrollDepth: number;
      engagementScore: number;
      totalSessions: number;
    }[];
  } = await res.json();

  // Index by URL for fast lookup
  const urlMap = new Map<
    string,
    {
      deadClicks: number;
      rageClicks: number;
      scrollDepth: number;
      engagementScore: number;
      totalSessions: number;
    }
  >();

  for (const page of clarityData.pages ?? []) {
    urlMap.set(page.url, {
      deadClicks: page.deadClicks,
      rageClicks: page.rageClicks,
      scrollDepth: page.scrollDepth,
      engagementScore: page.engagementScore,
      totalSessions: page.totalSessions,
    });
  }

  const results: EnrichmentResult[] = [];

  for (const url of pageUrls) {
    const metrics = urlMap.get(url);

    results.push({
      provider: "clarity",
      pageUrl: url,
      data: {
        deadClicks: metrics?.deadClicks ?? null,
        rageClicks: metrics?.rageClicks ?? null,
        scrollDepth: metrics?.scrollDepth ?? null,
        engagementScore: metrics?.engagementScore ?? null,
        totalSessions: metrics?.totalSessions ?? 0,
      },
    });
  }

  return results;
}
