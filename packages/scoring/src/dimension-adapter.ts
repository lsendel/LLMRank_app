/**
 * Dimension Adapter — bridges v1 (4-pillar) and v2 (7-dimension) scoring models.
 *
 * - scoringResultToDimensions: converts v1 ScoringResult + issues into DimensionScores
 * - dimensionsToLegacyScores: maps 7 dimensions back to 4-pillar scores for backwards compat
 */

import type { Issue, DimensionId, DimensionScores } from "@llm-boost/shared";
import { DIMENSION_IDS, ISSUE_DEFINITIONS } from "@llm-boost/shared";
import type { ScoringResult } from "./types";

// ---------------------------------------------------------------------------
// v1 → v2: Convert ScoringResult issues into per-dimension scores
// ---------------------------------------------------------------------------

/**
 * Computes a DimensionScores record from a set of issues.
 *
 * For each of the 7 dimensions, starts at 100 and subtracts the `scoreImpact`
 * of every issue whose definition maps to that dimension.  The result is
 * clamped to [0, 100].
 *
 * @param _result  The v1 ScoringResult (reserved for future use; currently unused)
 * @param issues   The list of issues found during scoring
 */
export function scoringResultToDimensions(
  _result: ScoringResult,
  issues: Issue[],
): DimensionScores {
  // Initialise every dimension at 100
  const scores: Record<string, number> = {};
  for (const dim of DIMENSION_IDS) {
    scores[dim] = 100;
  }

  // Apply deductions from each issue
  for (const issue of issues) {
    const def = ISSUE_DEFINITIONS[issue.code];
    if (!def) continue; // unknown issue code — skip

    const dimension: DimensionId = def.dimension;
    // scoreImpact is negative (e.g. -15), so adding it deducts from 100
    scores[dimension] += def.scoreImpact;
  }

  // Clamp all scores to [0, 100]
  for (const dim of DIMENSION_IDS) {
    scores[dim] = Math.max(0, Math.min(100, scores[dim]));
  }

  return scores as DimensionScores;
}

// ---------------------------------------------------------------------------
// v2 → v1: Map 7 dimensions back to 4-pillar legacy scores
// ---------------------------------------------------------------------------

/**
 * Maps 7-dimension scores back to the legacy 4-pillar format.
 *
 * The mapping uses simple averages of overlapping dimensions:
 *
 * - technicalScore    ≈ avg(meta_tags, sitemap, robots_crawlability, bot_access)
 * - contentScore      ≈ content_citeability
 * - aiReadinessScore  ≈ avg(llms_txt, robots_crawlability, schema_markup)
 * - performanceScore  ≈ bot_access
 *
 * This is intentionally approximate — exact parity with the v1 engine is not
 * required, only a reasonable backwards-compatible mapping.
 */
export function dimensionsToLegacyScores(dims: DimensionScores): {
  technicalScore: number;
  contentScore: number;
  aiReadinessScore: number;
  performanceScore: number;
} {
  const technicalScore = Math.round(
    (dims.meta_tags +
      dims.sitemap +
      dims.robots_crawlability +
      dims.bot_access) /
      4,
  );

  const contentScore = Math.round(dims.content_citeability);

  const aiReadinessScore = Math.round(
    (dims.llms_txt + dims.robots_crawlability + dims.schema_markup) / 3,
  );

  const performanceScore = Math.round(dims.bot_access);

  return {
    technicalScore,
    contentScore,
    aiReadinessScore,
    performanceScore,
  };
}
