"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PageEnrichment } from "@/lib/api";

interface PageEnrichmentsSectionProps {
  enrichments: PageEnrichment[];
}

export function PageEnrichmentsSection({
  enrichments,
}: PageEnrichmentsSectionProps) {
  const byProvider = enrichments.reduce<Record<string, PageEnrichment>>(
    (acc, e) => {
      acc[e.provider] = e;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      {/* GSC -- Google Search Console */}
      {byProvider.gsc && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Google Search Console</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {byProvider.gsc.data.indexedStatus != null && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Indexed Status:</span>
                <Badge
                  variant={
                    byProvider.gsc.data.indexedStatus === "INDEXED"
                      ? "success"
                      : "destructive"
                  }
                >
                  {String(byProvider.gsc.data.indexedStatus)}
                </Badge>
              </div>
            )}
            {Array.isArray(byProvider.gsc.data.queries) &&
              (byProvider.gsc.data.queries as Record<string, unknown>[])
                .length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Top Search Queries</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Query</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">
                          Impressions
                        </TableHead>
                        <TableHead className="text-right">Position</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(
                        byProvider.gsc.data.queries as Record<string, unknown>[]
                      ).map((q, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">
                            {String(q.query ?? "")}
                          </TableCell>
                          <TableCell className="text-right">
                            {String(q.clicks ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {String(q.impressions ?? 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {typeof q.position === "number"
                              ? q.position.toFixed(1)
                              : "--"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* PSI -- PageSpeed Insights / Core Web Vitals */}
      {byProvider.psi && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Core Web Vitals (PageSpeed Insights)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  key: "LCP",
                  label: "Largest Contentful Paint",
                  unit: "s",
                  good: 2.5,
                  poor: 4,
                },
                {
                  key: "CLS",
                  label: "Cumulative Layout Shift",
                  unit: "",
                  good: 0.1,
                  poor: 0.25,
                },
                {
                  key: "FID",
                  label: "First Input Delay",
                  unit: "ms",
                  good: 100,
                  poor: 300,
                },
              ].map((metric) => {
                const val = byProvider.psi?.data[metric.key];
                const num = typeof val === "number" ? val : null;
                let status = "";
                if (num != null) {
                  if (num <= metric.good) {
                    status = "text-success";
                  } else if (num <= metric.poor) {
                    status = "text-warning";
                  } else {
                    status = "text-destructive";
                  }
                }
                return (
                  <div
                    key={metric.key}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className={cn("text-2xl font-bold", status)}>
                      {num != null ? `${num}${metric.unit}` : "--"}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GA4 -- Google Analytics */}
      {byProvider.ga4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Google Analytics 4 -- Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Bounce Rate</p>
                <p className="text-2xl font-bold">
                  {typeof byProvider.ga4.data.bounceRate === "number"
                    ? `${(byProvider.ga4.data.bounceRate as number).toFixed(1)}%`
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Avg. Engagement Time
                </p>
                <p className="text-2xl font-bold">
                  {typeof byProvider.ga4.data.avgEngagementTime === "number"
                    ? `${(byProvider.ga4.data.avgEngagementTime as number).toFixed(0)}s`
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Sessions</p>
                <p className="text-2xl font-bold">
                  {byProvider.ga4.data.sessions != null
                    ? String(byProvider.ga4.data.sessions)
                    : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clarity -- Microsoft Clarity */}
      {byProvider.clarity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Microsoft Clarity -- UX Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Dead Clicks</p>
                <p className="text-2xl font-bold">
                  {byProvider.clarity.data.deadClicks != null
                    ? String(byProvider.clarity.data.deadClicks)
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Rage Clicks</p>
                <p className="text-2xl font-bold">
                  {byProvider.clarity.data.rageClicks != null
                    ? String(byProvider.clarity.data.rageClicks)
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Scroll Depth</p>
                <p className="text-2xl font-bold">
                  {typeof byProvider.clarity.data.scrollDepth === "number"
                    ? `${(byProvider.clarity.data.scrollDepth as number).toFixed(0)}%`
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Engagement Score
                </p>
                <p className="text-2xl font-bold">
                  {byProvider.clarity.data.engagementScore != null
                    ? String(byProvider.clarity.data.engagementScore)
                    : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fetched at timestamp */}
      {enrichments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Data fetched: {new Date(enrichments[0].fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
