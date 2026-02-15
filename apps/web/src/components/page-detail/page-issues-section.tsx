import { Card } from "@/components/ui/card";
import { IssueCard } from "@/components/issue-card";
import type { PageIssue } from "@/lib/api";

interface PageIssuesSectionProps {
  issues: PageIssue[];
}

export function PageIssuesSection({ issues }: PageIssuesSectionProps) {
  if (issues.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No issues found for this page.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {issues.map((issue, i) => (
        <IssueCard key={`${issue.code}-${i}`} {...issue} />
      ))}
    </div>
  );
}
