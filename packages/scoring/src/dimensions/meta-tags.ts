import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";
import { THRESHOLDS } from "../thresholds";

export function scoreMetaTags(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_TITLE
  if (
    !page.title ||
    page.title.length < THRESHOLDS.title.min ||
    page.title.length > THRESHOLDS.title.max
  ) {
    deduct(s, "MISSING_TITLE", { titleLength: page.title?.length ?? 0 });
  }

  // MISSING_META_DESC
  if (
    !page.metaDescription ||
    page.metaDescription.length < THRESHOLDS.metaDesc.min ||
    page.metaDescription.length > THRESHOLDS.metaDesc.max
  ) {
    deduct(s, "MISSING_META_DESC", {
      descLength: page.metaDescription?.length ?? 0,
    });
  }

  // MISSING_OG_TAGS
  const ogTags = page.extracted.og_tags ?? {};
  if (!ogTags["og:title"] || !ogTags["og:description"] || !ogTags["og:image"]) {
    deduct(s, "MISSING_OG_TAGS");
  }

  // MISSING_CANONICAL
  if (!page.canonicalUrl) {
    deduct(s, "MISSING_CANONICAL");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
