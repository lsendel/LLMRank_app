import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreCircle } from "@/components/score-circle";
import { DetailRow } from "@/components/page-detail/detail-row";
import type { PageScoreDetail } from "@/lib/api";

interface PagePerformanceSectionProps {
  page: PageScoreDetail;
}

export function PagePerformanceSection({ page }: PagePerformanceSectionProps) {
  const detail = page.score?.detail ?? {};
  const lighthouse = detail.lighthouse as Record<string, number> | null;

  return (
    <div className="space-y-4">
      {lighthouse ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Performance", key: "performance" },
            { label: "SEO", key: "seo" },
            { label: "Accessibility", key: "accessibility" },
            { label: "Best Practices", key: "best_practices" },
          ].map(({ label, key }) => {
            const raw = lighthouse[key];
            const score = raw != null ? Math.round(raw * 100) : null;
            return (
              <Card key={key} className="flex items-center justify-center p-6">
                <ScoreCircle score={score ?? 0} size={120} label={label} />
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No Lighthouse data available for this page.
          </p>
        </Card>
      )}

      {page.score?.lighthousePerf != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Stored Lighthouse Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailRow
              label="Lighthouse Performance"
              value={`${Math.round(page.score.lighthousePerf * 100)}%`}
            />
            <DetailRow
              label="Lighthouse SEO"
              value={
                page.score.lighthouseSeo != null
                  ? `${Math.round(page.score.lighthouseSeo * 100)}%`
                  : undefined
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
