import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const CLARITY_API =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

/**
 * Fetch Microsoft Clarity insights via the Data Export API.
 * The API token identifies the project — no separate projectId needed.
 * Limited to last 1-3 days, max 10 requests/project/day.
 */
export async function fetchClarityData(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { pageUrls, credentials } = ctx;
  const apiToken = credentials.apiKey || credentials.apiToken;

  if (!apiToken) {
    throw new Error("Clarity API token is required");
  }

  // Fetch with URL dimension to get per-page breakdown (max 3 days)
  const params = new URLSearchParams({
    numOfDays: "3",
    dimension1: "URL",
  });

  const res = await fetch(`${CLARITY_API}?${params}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Clarity API error: ${res.status} ${body}`);
  }

  const data: {
    metricName: string;
    information: Record<string, string>[];
  }[] = await res.json();

  // Build a map of URL -> metrics from the various metric groups
  const urlMetrics = new Map<
    string,
    {
      sessions: number;
      deadClicks: number;
      rageClicks: number;
      scrollDepth: number;
      engagementTime: number;
    }
  >();

  const ensureUrl = (url: string) => {
    if (!urlMetrics.has(url)) {
      urlMetrics.set(url, {
        sessions: 0,
        deadClicks: 0,
        rageClicks: 0,
        scrollDepth: 0,
        engagementTime: 0,
      });
    }
    return urlMetrics.get(url)!;
  };

  for (const metric of data) {
    for (const row of metric.information ?? []) {
      const url = row.URL || row.url;
      if (!url) continue;

      const entry = ensureUrl(url);

      switch (metric.metricName) {
        case "Traffic":
          entry.sessions =
            parseInt(row.totalSessionCount || "0", 10) || entry.sessions;
          break;
        case "Dead Click Count":
          entry.deadClicks =
            parseInt(
              row["Dead Click Count"] || row.deadClickCount || "0",
              10,
            ) || entry.deadClicks;
          break;
        case "Rage Click Count":
          entry.rageClicks =
            parseInt(
              row["Rage Click Count"] || row.rageClickCount || "0",
              10,
            ) || entry.rageClicks;
          break;
        case "Scroll Depth":
          entry.scrollDepth =
            parseFloat(row["Scroll Depth"] || row.scrollDepth || "0") ||
            entry.scrollDepth;
          break;
        case "Engagement Time":
          entry.engagementTime =
            parseFloat(row["Engagement Time"] || row.engagementTime || "0") ||
            entry.engagementTime;
          break;
      }
    }
  }

  // Match against the crawled page URLs
  const results: EnrichmentResult[] = [];

  for (const pageUrl of pageUrls) {
    // Try exact match first, then partial match
    let metrics = urlMetrics.get(pageUrl);
    if (!metrics) {
      // Try matching by path (Clarity may store full URLs differently)
      for (const [clarityUrl, m] of urlMetrics) {
        if (clarityUrl.includes(pageUrl) || pageUrl.includes(clarityUrl)) {
          metrics = m;
          break;
        }
      }
    }

    results.push({
      provider: "clarity",
      pageUrl,
      data: {
        deadClicks: metrics?.deadClicks ?? null,
        rageClicks: metrics?.rageClicks ?? null,
        scrollDepth: metrics?.scrollDepth ?? null,
        engagementScore: null, // Not available in Data Export API
        totalSessions: metrics?.sessions ?? 0,
        engagementTime: metrics?.engagementTime ?? 0,
      },
    });
  }

  return results;
}
