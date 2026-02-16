import type { Persona } from "./schemas/api";

export const DASHBOARD_WIDGET_IDS = [
  "stats",
  "score_momentum",
  "quick_wins",
  "readiness",
  "activity",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const PERSONA_WIDGET_ORDER: Record<Persona, DashboardWidgetId[]> = {
  agency: ["stats", "activity", "quick_wins", "score_momentum", "readiness"],
  freelancer: [
    "quick_wins",
    "score_momentum",
    "stats",
    "readiness",
    "activity",
  ],
  in_house: ["score_momentum", "readiness", "quick_wins", "stats", "activity"],
  developer: ["stats", "quick_wins", "score_momentum", "readiness", "activity"],
};

export const DEFAULT_WIDGET_ORDER: DashboardWidgetId[] = [
  "stats",
  "score_momentum",
  "quick_wins",
  "readiness",
  "activity",
];
