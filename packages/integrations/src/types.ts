export interface IntegrationFetcherContext {
  domain: string;
  pageUrls: string[];
  credentials: Record<string, string>;
  config: Record<string, unknown>;
}

export interface EnrichmentResult {
  provider: string;
  pageUrl: string;
  data: Record<string, unknown>;
}

export type IntegrationFetcher = (
  ctx: IntegrationFetcherContext,
) => Promise<EnrichmentResult[]>;
