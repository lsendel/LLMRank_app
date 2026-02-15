"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DetailRow } from "@/components/page-detail/detail-row";
import type { PageScoreDetail } from "@/lib/api";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface PageLinkGraphSectionProps {
  page: PageScoreDetail;
}

export function PageLinkGraphSection({ page }: PageLinkGraphSectionProps) {
  const detail = page.score?.detail ?? {};
  const extracted = (detail.extracted ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schema.org Types</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(extracted.schema_types) &&
            (extracted.schema_types as string[]).length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(extracted.schema_types as string[]).map((type, i) => (
                  <Badge key={i} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No Schema.org types found.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open Graph Tags</CardTitle>
          </CardHeader>
          <CardContent>
            {extracted.og_tags &&
            typeof extracted.og_tags === "object" &&
            Object.keys(extracted.og_tags as object).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(
                  extracted.og_tags as Record<string, string>,
                ).map(([key, val]) => (
                  <DetailRow key={key} label={key} value={val} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No OG tags found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal Links</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(extracted.internal_links) ? (
              <p className="text-2xl font-bold">
                {(extracted.internal_links as string[]).length}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">External Links</CardTitle>
          </CardHeader>
          <CardContent>
            {Array.isArray(extracted.external_links) ? (
              <p className="text-2xl font-bold">
                {(extracted.external_links as string[]).length}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">N/A</p>
            )}
          </CardContent>
        </Card>
      </div>

      {extracted.images_without_alt != null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Images Without Alt Text</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-bold",
                (extracted.images_without_alt as number) > 0
                  ? "text-destructive"
                  : "text-success",
              )}
            >
              {extracted.images_without_alt as number}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Link Graph Visualization</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] border rounded-md overflow-hidden bg-slate-50 relative">
          <div className="absolute inset-0">
            <ForceGraph2D
              width={800}
              height={400}
              graphData={{
                nodes: [
                  {
                    id: "current",
                    name: "Current Page",
                    val: 10,
                    color: "#2563eb",
                  },
                  ...(Array.isArray(extracted.internal_links)
                    ? (extracted.internal_links as string[])
                        .slice(0, 20)
                        .map((l, i) => ({
                          id: `int-${i}`,
                          name: l,
                          val: 3,
                          color: "#16a34a",
                        }))
                    : []),
                  ...(Array.isArray(extracted.external_links)
                    ? (extracted.external_links as string[])
                        .slice(0, 10)
                        .map((l, i) => ({
                          id: `ext-${i}`,
                          name: l,
                          val: 3,
                          color: "#dc2626",
                        }))
                    : []),
                ],
                links: [
                  ...(Array.isArray(extracted.internal_links)
                    ? (extracted.internal_links as string[])
                        .slice(0, 20)
                        .map((_, i) => ({
                          source: "current",
                          target: `int-${i}`,
                        }))
                    : []),
                  ...(Array.isArray(extracted.external_links)
                    ? (extracted.external_links as string[])
                        .slice(0, 10)
                        .map((_, i) => ({
                          source: "current",
                          target: `ext-${i}`,
                        }))
                    : []),
                ],
              }}
              nodeLabel="name"
              nodeRelSize={6}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={(_d) => 0.005}
            />
          </div>
          <div className="absolute bottom-2 right-2 flex gap-4 text-xs bg-white/80 p-2 rounded">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div> Current
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-600"></div> Internal
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-600"></div> External
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
