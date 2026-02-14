export type {
  IntegrationFetcherContext,
  EnrichmentResult,
  IntegrationFetcher,
} from "./types";

export { fetchGSCData } from "./fetchers/gsc";
export { fetchPSIData } from "./fetchers/psi";
export { fetchGA4Data } from "./fetchers/ga4";
export { fetchClarityData } from "./fetchers/clarity";

import type {
  IntegrationFetcher,
  IntegrationFetcherContext,
  EnrichmentResult,
} from "./types";
import { fetchGSCData } from "./fetchers/gsc";
import { fetchPSIData } from "./fetchers/psi";
import { fetchGA4Data } from "./fetchers/ga4";
import { fetchClarityData } from "./fetchers/clarity";

export const INTEGRATION_FETCHERS: Record<string, IntegrationFetcher> = {
  gsc: fetchGSCData,
  psi: fetchPSIData,
  ga4: fetchGA4Data,
  clarity: fetchClarityData,
};

/**
 * Run enrichments for all enabled integrations.
 * Returns flat array of per-page enrichment results.
 */
export async function runEnrichments(
  integrations: {
    provider: string;
    credentials: Record<string, string>;
    config: Record<string, unknown>;
  }[],
  domain: string,
  pageUrls: string[],
): Promise<EnrichmentResult[]> {
  const results: EnrichmentResult[] = [];

  const settled = await Promise.allSettled(
    integrations.map(async (integration) => {
      const fetcher = INTEGRATION_FETCHERS[integration.provider];
      if (!fetcher) return [];

      const ctx: IntegrationFetcherContext = {
        domain,
        pageUrls,
        credentials: integration.credentials,
        config: integration.config,
      };

      return fetcher(ctx);
    }),
  );

  for (const result of settled) {
    if (result.status === "fulfilled") {
      results.push(...result.value);
    } else {
      console.error("Integration fetcher failed:", result.reason);
    }
  }

  return results;
}
