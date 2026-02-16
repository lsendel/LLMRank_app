import type { Persona, PersonaQuestionnaire } from "@llm-boost/shared";

export interface ClassificationResult {
  persona: Persona;
  confidence: "high" | "medium";
  reasoning: string;
}

/**
 * Rule-based persona classification from questionnaire answers.
 *
 * Decision tree:
 *   client_reporting + large_team  → agency
 *   client_reporting + small_team  → agency
 *   client_reporting + solo        → freelancer
 *   own_site_optimization          → in_house
 *   technical_audit                → developer
 *   competitive_analysis           → in_house
 *   fallback                       → in_house
 */
export function classifyPersona(
  answers: PersonaQuestionnaire,
): ClassificationResult {
  const { teamSize, primaryGoal } = answers;

  if (primaryGoal === "client_reporting") {
    if (teamSize === "solo") {
      return {
        persona: "freelancer",
        confidence: "high",
        reasoning:
          "Solo practitioner managing client sites — optimized for quick wins and client reporting.",
      };
    }
    return {
      persona: "agency",
      confidence: "high",
      reasoning:
        "Team managing multiple client sites — optimized for portfolio overview and activity tracking.",
    };
  }

  if (primaryGoal === "own_site_optimization") {
    return {
      persona: "in_house",
      confidence: "high",
      reasoning:
        "Optimizing own site — optimized for score trends and readiness coverage.",
    };
  }

  if (primaryGoal === "technical_audit") {
    return {
      persona: "developer",
      confidence: "high",
      reasoning:
        "Focused on technical SEO audits — optimized for data density and technical quick wins.",
    };
  }

  if (primaryGoal === "competitive_analysis") {
    return {
      persona: "in_house",
      confidence: "medium",
      reasoning:
        "Competitive analysis focus — in-house layout prioritizes trend tracking and coverage.",
    };
  }

  // Fallback
  return {
    persona: "in_house",
    confidence: "medium",
    reasoning:
      "Default classification — in-house layout provides balanced dashboard.",
  };
}
