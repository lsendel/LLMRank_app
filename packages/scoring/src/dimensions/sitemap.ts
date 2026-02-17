import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreSitemap(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_SITEMAP
  if (page.siteContext && !page.siteContext.hasSitemap) {
    deduct(s, "MISSING_SITEMAP");
  }

  // SITEMAP_INVALID_FORMAT
  if (
    page.siteContext?.hasSitemap &&
    page.siteContext.sitemapAnalysis &&
    !page.siteContext.sitemapAnalysis.isValid
  ) {
    deduct(s, "SITEMAP_INVALID_FORMAT");
  }

  // SITEMAP_STALE_URLS
  if (
    page.siteContext?.sitemapAnalysis &&
    page.siteContext.sitemapAnalysis.staleUrlCount > 0
  ) {
    deduct(s, "SITEMAP_STALE_URLS", {
      staleUrlCount: page.siteContext.sitemapAnalysis.staleUrlCount,
      totalUrls: page.siteContext.sitemapAnalysis.urlCount,
    });
  }

  // SITEMAP_LOW_COVERAGE
  if (
    page.siteContext?.sitemapAnalysis &&
    page.siteContext.sitemapAnalysis.discoveredPageCount > 0
  ) {
    const coverage =
      page.siteContext.sitemapAnalysis.urlCount /
      page.siteContext.sitemapAnalysis.discoveredPageCount;
    if (coverage < THRESHOLDS.sitemapCoverageMin) {
      deduct(s, "SITEMAP_LOW_COVERAGE", {
        sitemapUrls: page.siteContext.sitemapAnalysis.urlCount,
        discoveredPages: page.siteContext.sitemapAnalysis.discoveredPageCount,
        coverage: Math.round(coverage * 100),
      });
    }
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
