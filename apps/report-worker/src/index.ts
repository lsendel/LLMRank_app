import { createDb } from "@llm-boost/db";
import { reports, eq } from "@llm-boost/db";
import { renderPdf } from "@llm-boost/reports";
import { renderDocx } from "@llm-boost/reports";
import { aggregateReportData } from "@llm-boost/reports";
import type { GenerateReportJob } from "@llm-boost/reports";
import { fetchReportData } from "./data-fetcher";

interface Env {
  R2: R2Bucket;
  DATABASE_URL: string;
}

export default {
  async queue(batch: MessageBatch<GenerateReportJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const job = message.body;
      const db = createDb(env.DATABASE_URL);

      try {
        // Update status to generating
        await db
          .update(reports)
          .set({ status: "generating" })
          .where(eq(reports.id, job.reportId));

        // Fetch all data from DB
        const rawData = await fetchReportData(db, job);

        // Aggregate into report structure
        const reportData = aggregateReportData(rawData, {
          type: job.type,
          config: job.config,
        });

        // Render document
        const buffer =
          job.format === "pdf"
            ? await renderPdf(reportData, job.type)
            : await renderDocx(reportData, job.type);

        // Upload to R2
        const r2Key = `reports/${job.projectId}/${job.reportId}.${job.format}`;
        const contentType =
          job.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        await env.R2.put(r2Key, buffer, {
          httpMetadata: { contentType },
        });

        // Update report record as complete
        await db
          .update(reports)
          .set({
            status: "complete",
            r2Key,
            fileSize: buffer.byteLength,
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          })
          .where(eq(reports.id, job.reportId));

        message.ack();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        await db
          .update(reports)
          .set({ status: "failed", error: errorMsg })
          .where(eq(reports.id, job.reportId));

        message.retry();
      }
    }
  },
};
