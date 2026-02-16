"use client";

import { useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PaginatedResponse, type Project } from "@/lib/api";

export function BrandingSection() {
  const { data: projectsData } = useApiSWR<PaginatedResponse<Project>>(
    "projects-for-tokens",
    useCallback(() => api.projects.list({ limit: 100 }), []),
  );

  return (
    <div className="pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Branding</CardTitle>
          <CardDescription>
            Branding is configured per-project to support multiple clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To customize your report branding (logo, company name, colors), go
            to any project and open its <strong>Settings</strong> tab.
          </p>
          {projectsData?.data && projectsData.data.length > 0 && (
            <div className="mt-4 space-y-2">
              {projectsData.data.slice(0, 5).map((p) => (
                <a
                  key={p.id}
                  href={`/dashboard/projects/${p.id}?tab=settings`}
                  className="block rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {p.name}{" "}
                  <span className="text-muted-foreground">&rarr; Settings</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
