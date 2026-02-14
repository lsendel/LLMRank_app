import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const GSC_API = "https://www.googleapis.com/webmasters/v3";

export async function fetchGSCData(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { domain, pageUrls, credentials } = ctx;
  const { accessToken } = credentials;

  const siteUrl = `sc-domain:${domain}`;
  const encodedSite = encodeURIComponent(siteUrl);

  // Fetch search analytics data for the last 28 days
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 28 * 24 * 60 * 60 * 1000);

  const analyticsRes = await fetch(
    `${GSC_API}/sites/${encodedSite}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        dimensions: ["page", "query"],
        rowLimit: 5000,
      }),
    },
  );

  if (!analyticsRes.ok) {
    throw new Error(`GSC Search Analytics API error: ${analyticsRes.status}`);
  }

  const analyticsData: {
    rows?: {
      keys: string[];
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }[];
  } = await analyticsRes.json();

  // Group results by page URL
  const pageMap = new Map<
    string,
    {
      queries: {
        query: string;
        clicks: number;
        impressions: number;
        position: number;
      }[];
      totalClicks: number;
      totalImpressions: number;
    }
  >();

  for (const row of analyticsData.rows ?? []) {
    const pageUrl = row.keys[0];
    const query = row.keys[1];

    if (!pageMap.has(pageUrl)) {
      pageMap.set(pageUrl, {
        queries: [],
        totalClicks: 0,
        totalImpressions: 0,
      });
    }

    const entry = pageMap.get(pageUrl)!;
    entry.queries.push({
      query,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
    });
    entry.totalClicks += row.clicks;
    entry.totalImpressions += row.impressions;
  }

  // Check URL inspection status for each page
  const results: EnrichmentResult[] = [];

  for (const url of pageUrls) {
    const analytics = pageMap.get(url);

    let indexedStatus: string | null = null;
    try {
      const inspectRes = await fetch(`${GSC_API}/urlInspection/index:inspect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inspectionUrl: url,
          siteUrl,
        }),
      });

      if (inspectRes.ok) {
        const inspectData: {
          inspectionResult?: {
            indexStatusResult?: { coverageState?: string };
          };
        } = await inspectRes.json();
        indexedStatus =
          inspectData.inspectionResult?.indexStatusResult?.coverageState ??
          null;
      }
    } catch {
      // URL inspection may not be available for all URLs
    }

    results.push({
      provider: "gsc",
      pageUrl: url,
      data: {
        queries: analytics?.queries?.slice(0, 20) ?? [],
        totalClicks: analytics?.totalClicks ?? 0,
        totalImpressions: analytics?.totalImpressions ?? 0,
        indexedStatus,
      },
    });
  }

  return results;
}
