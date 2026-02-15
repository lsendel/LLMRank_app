"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailRow } from "@/components/page-detail/detail-row";
import type { PageScoreDetail } from "@/lib/api";

interface PageTechnicalSectionProps {
  page: PageScoreDetail;
  isAiAvailable: boolean;
  analyzingField: string | null;
  aiSuggestions: Record<string, string>;
  onAiSuggestion: (field: "title" | "metaDesc", content: string) => void;
}

export function PageTechnicalSection({
  page,
  isAiAvailable,
  analyzingField,
  aiSuggestions,
  onAiSuggestion,
}: PageTechnicalSectionProps) {
  const detail = page.score?.detail ?? {};
  const extracted = (detail.extracted ?? {}) as Record<string, unknown>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Technical Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailRow label="Canonical URL" value={page.canonicalUrl} />
        <div className="space-y-2">
          <DetailRow label="Meta Description" value={page.metaDesc} />
          {isAiAvailable && page.metaDesc && (
            <div className="pl-40">
              <button
                onClick={() => onAiSuggestion("metaDesc", page.metaDesc!)}
                disabled={analyzingField === "metaDesc"}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {analyzingField === "metaDesc"
                  ? "Generating..."
                  : "Suggest Improvement with AI"}
              </button>
              {aiSuggestions.metaDesc && (
                <div className="mt-2 text-sm bg-muted/50 p-2 rounded border border-border">
                  <p className="font-medium text-xs text-muted-foreground mb-1">
                    AI Suggestion:
                  </p>
                  {aiSuggestions.metaDesc}
                </div>
              )}
            </div>
          )}
        </div>
        <DetailRow label="HTTP Status" value={page.statusCode?.toString()} />
        <DetailRow
          label="Robots Directives"
          value={
            Array.isArray(extracted.robots_directives)
              ? (extracted.robots_directives as string[]).join(", ") || "None"
              : "N/A"
          }
        />
        <DetailRow
          label="Has Robots Meta"
          value={
            extracted.has_robots_meta != null
              ? String(extracted.has_robots_meta)
              : "N/A"
          }
        />
        <DetailRow
          label="Schema Types"
          value={
            Array.isArray(extracted.schema_types)
              ? (extracted.schema_types as string[]).join(", ") || "None found"
              : "N/A"
          }
        />
      </CardContent>
    </Card>
  );
}
