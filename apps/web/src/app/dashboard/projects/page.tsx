import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder data -- will be replaced with API calls
const placeholderProjects = [
  {
    id: "1",
    name: "acme.com",
    domain: "https://acme.com",
    lastScore: 72,
    lastCrawl: "2025-01-15T10:30:00Z",
    pagesScanned: 45,
  },
  {
    id: "2",
    name: "widgets.io",
    domain: "https://widgets.io",
    lastScore: 58,
    lastCrawl: "2025-01-14T08:15:00Z",
    pagesScanned: 22,
  },
  {
    id: "3",
    name: "blog.example.com",
    domain: "https://blog.example.com",
    lastScore: 85,
    lastCrawl: "2025-01-15T12:00:00Z",
    pagesScanned: 12,
  },
];

function gradeColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function gradeBadgeVariant(
  score: number,
): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your website projects and view their AI-readiness scores.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Projects grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderProjects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <Card className="group transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold group-hover:text-primary">
                      {project.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {project.domain}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-2xl font-bold ${gradeColor(project.lastScore)}`}
                    >
                      {project.lastScore}
                    </span>
                    <Badge variant={gradeBadgeVariant(project.lastScore)}>
                      {project.lastScore >= 80
                        ? "Good"
                        : project.lastScore >= 60
                          ? "Needs Work"
                          : "Poor"}
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <span>{project.pagesScanned} pages scanned</span>
                  <span>
                    Last crawl:{" "}
                    {new Date(project.lastCrawl).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {placeholderProjects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground">No projects yet.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/projects/new">
                <Plus className="h-4 w-4" />
                Create your first project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
