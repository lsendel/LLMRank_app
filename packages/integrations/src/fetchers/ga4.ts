import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

export async function fetchGA4Data(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { pageUrls, credentials, config } = ctx;
  const { accessToken } = credentials;
  const propertyId = config.propertyId as string | undefined;

  if (!propertyId) {
    throw new Error("GA4 property ID is required in integration config");
  }

  // Run a report for the last 28 days with page path as a dimension
  const res = await fetch(
    `${GA4_DATA_API}/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "sessions" },
          { name: "engagedSessions" },
          { name: "userEngagementDuration" },
        ],
        limit: 10000,
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`GA4 Data API error: ${res.status}`);
  }

  const report: {
    rows?: {
      dimensionValues: { value: string }[];
      metricValues: { value: string }[];
    }[];
  } = await res.json();

  // Build a map from path to metrics
  const pathMap = new Map<
    string,
    {
      bounceRate: number;
      avgSessionDuration: number;
      sessions: number;
      engagedSessions: number;
      engagementDuration: number;
    }
  >();

  for (const row of report.rows ?? []) {
    const path = row.dimensionValues[0].value;
    pathMap.set(path, {
      bounceRate: parseFloat(row.metricValues[0].value) || 0,
      avgSessionDuration: parseFloat(row.metricValues[1].value) || 0,
      sessions: parseInt(row.metricValues[2].value, 10) || 0,
      engagedSessions: parseInt(row.metricValues[3].value, 10) || 0,
      engagementDuration: parseFloat(row.metricValues[4].value) || 0,
    });
  }

  // Match page URLs to paths
  const results: EnrichmentResult[] = [];

  for (const url of pageUrls) {
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      continue;
    }

    const metrics = pathMap.get(path);

    results.push({
      provider: "ga4",
      pageUrl: url,
      data: {
        bounceRate: metrics?.bounceRate ?? null,
        avgSessionDuration: metrics?.avgSessionDuration ?? null,
        sessions: metrics?.sessions ?? 0,
        engagedSessions: metrics?.engagedSessions ?? 0,
        engagementDuration: metrics?.engagementDuration ?? 0,
      },
    });
  }

  return results;
}
