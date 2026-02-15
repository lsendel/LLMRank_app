"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContentRatioGauge } from "@/components/charts/content-ratio-gauge";
import { DetailRow } from "@/components/page-detail/detail-row";
import type { PageScoreDetail } from "@/lib/api";

interface PageContentSectionProps {
  page: PageScoreDetail;
  isAiAvailable: boolean;
  extractedTopics: string[];
  topicsLoading: boolean;
  onTopicExtraction: () => void;
}

export function PageContentSection({
  page,
  isAiAvailable,
  extractedTopics,
  topicsLoading,
  onTopicExtraction,
}: PageContentSectionProps) {
  const detail = page.score?.detail ?? {};
  const extracted = (detail.extracted ?? {}) as Record<string, unknown>;
  const textLength = page.textLength ?? null;
  const htmlLength = page.htmlLength ?? null;
  const ratio =
    textLength && htmlLength && htmlLength > 0
      ? (textLength / htmlLength) * 100
      : undefined;

  function getTopicButtonLabel(): string {
    if (topicsLoading) return "Analyzing...";
    if (extractedTopics.length > 0) return "Analyzed";
    return "Analyze Topics";
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ContentRatioGauge
          avgWordCount={page.wordCount ?? 0}
          pagesAboveThreshold={
            page.wordCount != null && page.wordCount >= 300 ? 1 : 0
          }
          totalPages={1}
          avgHtmlToTextRatio={ratio}
          totalTextLength={textLength ?? undefined}
          totalHtmlLength={htmlLength ?? undefined}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Heading Hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((tag) => {
            const headings = (extracted[tag] as string[]) ?? [];
            if (headings.length === 0) return null;
            return (
              <div key={tag}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {tag.toUpperCase()} ({headings.length})
                </p>
                <ul className="space-y-1">
                  {headings.map((h, i) => (
                    <li
                      key={i}
                      className="text-sm pl-2 border-l-2 border-muted"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {!extracted.h1 && (
            <p className="text-sm text-muted-foreground">
              No extracted heading data available.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DetailRow
            label="Word Count"
            value={page.wordCount?.toLocaleString()}
          />
          <DetailRow label="Content Hash" value={page.contentHash} />
        </CardContent>
      </Card>

      {isAiAvailable && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Key Topics (AI Extracted)
              </CardTitle>
              <button
                onClick={onTopicExtraction}
                disabled={topicsLoading || extractedTopics.length > 0}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {getTopicButtonLabel()}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {extractedTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {extractedTopics.map((topic, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Click analyze to extract core entities and topics from this
                page.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
