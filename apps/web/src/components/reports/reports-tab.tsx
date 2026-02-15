"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { api, type Report } from "@/lib/api";
import { GenerateReportModal } from "./generate-report-modal";
import { ReportList } from "./report-list";

interface Props {
  projectId: string;
  crawlJobId: string | undefined;
}

export default function ReportsTab({ projectId, crawlJobId }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const list = await api.reports.list(projectId);
      setReports(list);
    } catch {
      // Empty state shown
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Poll for in-progress reports
  useEffect(() => {
    const pending = reports.some(
      (r) => r.status === "queued" || r.status === "generating",
    );
    if (!pending) return;
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, [reports, fetchReports]);

  async function handleDelete(reportId: string) {
    try {
      await api.reports.delete(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      // Handle error
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowModal(true)}
          disabled={!crawlJobId}
          size="sm"
        >
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      <ReportList
        reports={reports}
        onDelete={handleDelete}
        onRefresh={fetchReports}
      />

      {crawlJobId && (
        <GenerateReportModal
          open={showModal}
          onClose={() => setShowModal(false)}
          projectId={projectId}
          crawlJobId={crawlJobId}
          onGenerated={fetchReports}
        />
      )}
    </div>
  );
}
