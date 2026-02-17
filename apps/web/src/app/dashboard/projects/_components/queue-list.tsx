"use client";

import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type PaginatedResponse, type CrawlJobSummary } from "@/lib/api";

const QUEUE_PER_PAGE = 10;

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "pending":
    case "queued":
      return "secondary";
    case "crawling":
    case "scoring":
      return "default";
    case "failed":
      return "destructive";
    case "complete":
      return "outline";
    default:
      return "default";
  }
}

export function QueueList() {
  const [page, setPage] = useState(0);

  const { data: result, isLoading: loading } = useApiSWR<
    PaginatedResponse<CrawlJobSummary>
  >(
    `queue-list-${page}`,
    useCallback(
      () => api.queue.list({ page: page + 1, limit: QUEUE_PER_PAGE }),
      [page],
    ),
    {
      refreshInterval: 5000,
    },
  );

  const jobs = result?.data ?? [];
  const pagination = result?.pagination;

  if (loading && !result) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
        <p className="text-muted-foreground">No active jobs in the queue.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Crawls will appear here while they are processing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Started</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">
                  {job.projectName || job.projectId}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(job.status)}>
                    {job.status}
                  </Badge>
                  {job.status === "failed" && job.errorMessage && (
                    <span
                      className="ml-2 text-xs text-destructive truncate max-w-[200px] inline-block align-bottom"
                      title={job.errorMessage}
                    >
                      {job.errorMessage}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {job.pagesCrawled} crawled / {job.pagesScored} scored
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {new Date(job.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * QUEUE_PER_PAGE + 1}–
            {Math.min((page + 1) * QUEUE_PER_PAGE, pagination.total)} of{" "}
            {pagination.total} jobs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
