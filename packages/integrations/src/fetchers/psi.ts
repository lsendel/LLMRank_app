import type { IntegrationFetcherContext, EnrichmentResult } from "../types";

const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const MAX_CONCURRENT = 5;

export async function fetchPSIData(
  ctx: IntegrationFetcherContext,
): Promise<EnrichmentResult[]> {
  const { pageUrls, credentials } = ctx;
  const { apiKey } = credentials;

  const results: EnrichmentResult[] = [];

  // Process in batches of MAX_CONCURRENT to stay within rate limits
  for (let i = 0; i < pageUrls.length; i += MAX_CONCURRENT) {
    const batch = pageUrls.slice(i, i + MAX_CONCURRENT);

    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const params = new URLSearchParams({
          url,
          key: apiKey,
          category: "performance",
          strategy: "mobile",
        });

        const res = await fetch(`${PSI_API}?${params}`);
        if (!res.ok) {
          throw new Error(`PSI API error for ${url}: ${res.status}`);
        }

        const data: {
          loadingExperience?: {
            metrics?: Record<
              string,
              {
                percentile?: number;
                category?: string;
              }
            >;
            overall_category?: string;
          };
          lighthouseResult?: {
            categories?: {
              performance?: { score?: number };
            };
            audits?: Record<string, { numericValue?: number; score?: number }>;
          };
        } = await res.json();

        const crux = data.loadingExperience?.metrics ?? {};
        const audits = data.lighthouseResult?.audits ?? {};

        return {
          provider: "psi" as const,
          pageUrl: url,
          data: {
            cruxOverall: data.loadingExperience?.overall_category ?? null,
            lcp: {
              value: crux.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
              category: crux.LARGEST_CONTENTFUL_PAINT_MS?.category ?? null,
            },
            fid: {
              value:
                crux.FIRST_INPUT_DELAY_MS?.percentile ??
                crux.INTERACTION_TO_NEXT_PAINT?.percentile ??
                null,
              category:
                crux.FIRST_INPUT_DELAY_MS?.category ??
                crux.INTERACTION_TO_NEXT_PAINT?.category ??
                null,
            },
            cls: {
              value: crux.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? null,
              category: crux.CUMULATIVE_LAYOUT_SHIFT_SCORE?.category ?? null,
            },
            fcp: {
              value: crux.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? null,
              category: crux.FIRST_CONTENTFUL_PAINT_MS?.category ?? null,
            },
            ttfb: {
              value: crux.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ?? null,
              category: crux.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.category ?? null,
            },
            labPerformanceScore:
              data.lighthouseResult?.categories?.performance?.score ?? null,
            labSpeedIndex: audits["speed-index"]?.numericValue ?? null,
            labTBT: audits["total-blocking-time"]?.numericValue ?? null,
          },
        };
      }),
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}
