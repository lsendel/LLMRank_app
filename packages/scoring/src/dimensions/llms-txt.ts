import type { PageData, FactorResult } from "../types";
import { deduct, type ScoreState } from "../factors/helpers";

export function scoreLlmsTxt(page: PageData): FactorResult {
  const s: ScoreState = { score: 100, issues: [] };

  // MISSING_LLMS_TXT: -20 if siteContext.hasLlmsTxt is false
  if (page.siteContext && !page.siteContext.hasLlmsTxt) {
    deduct(s, "MISSING_LLMS_TXT");
  }

  return { score: Math.max(0, s.score), issues: s.issues };
}
