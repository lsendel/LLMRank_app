import { Resend } from "resend";
import {
  type Database,
  outboxQueries,
  outboxEvents,
  eq,
  and,
  lte,
  issues,
  sql,
} from "@llm-boost/db";
import { aggregatePageScores } from "@llm-boost/shared";
import { createLogger } from "../lib/logger";
import type { CrawlSummaryData } from "./summary";

export interface NotificationService {
  queueEmail(args: {
    userId: string;
    to: string;
    template:
      | "crawl_completed"
      | "credit_alert"
      | "competitor_alert"
      | "score_drop";
    data: Record<string, unknown>;
  }): Promise<void>;

  sendCrawlComplete(args: {
    userId: string;
    projectId: string;
    projectName: string;
    jobId: string;
  }): Promise<void>;

  sendScoreDrop(args: {
    userId: string;
    projectId: string;
    projectName: string;
    previousScore: number;
    currentScore: number;
  }): Promise<void>;

  processQueue(): Promise<void>;
}

const DEFAULT_APP_URL = "https://app.llmboost.io";

export function createNotificationService(
  db: Database,
  resendApiKey: string,
  options: { appBaseUrl?: string } = {},
): NotificationService {
  const log = createLogger({ context: "notification-service" });
  const resend = new Resend(resendApiKey);
  const outbox = outboxQueries(db);
  const appBaseUrl = normalizeBaseUrl(options.appBaseUrl);

  return {
    async queueEmail(args) {
      log.info("Queueing email notification", {
        userId: args.userId,
        template: args.template,
      });

      await outbox.enqueue({
        type: `email:${args.template}`,
        payload: {
          userId: args.userId,
          to: args.to,
          data: args.data,
        },
      });
    },

    async sendCrawlComplete(args) {
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;

      const payload = await buildCrawlCompletePayload(db, args, appBaseUrl);

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "crawl_completed",
        data: payload,
      });
    },

    async sendScoreDrop(args) {
      if (args.currentScore >= args.previousScore) return;
      const user = await db.query.users.findFirst({
        where: (u, { eq }) => eq(u.id, args.userId),
      });
      if (!user?.email) return;

      await this.queueEmail({
        userId: args.userId,
        to: user.email,
        template: "score_drop",
        data: args,
      });
    },

    async processQueue() {
      // Pick up pending outbox events and send them via Resend
      const events = await db
        .select()
        .from(outboxEvents)
        .where(
          and(
            eq(outboxEvents.status, "pending"),
            lte(outboxEvents.availableAt, new Date()),
          ) as any,
        )
        .limit(20);

      for (const event of events) {
        try {
          if (event.type.startsWith("email:")) {
            const { to, data } = event.payload as any;

            await resend.emails.send({
              from: "LLM Boost <notifications@llmboost.io>",
              to: [to],
              subject: getSubject(event.type),
              html: renderTemplate(event.type, data),
            });
          }

          await db
            .update(outboxEvents)
            .set({ status: "completed", processedAt: new Date() } as any)
            .where(eq(outboxEvents.id, event.id) as any);
        } catch (err) {
          log.error("Failed to process notification event", {
            eventId: event.id,
            error: String(err),
          });
          await db
            .update(outboxEvents)
            .set({ attempts: event.attempts + 1 } as any)
            .where(eq(outboxEvents.id, event.id) as any);
        }
      }
    },
  };
}

type CrawlCompleteArgs = {
  projectId: string;
  projectName: string;
  jobId: string;
};

async function buildCrawlCompletePayload(
  db: Database,
  args: CrawlCompleteArgs,
  baseUrl: string,
) {
  const crawl = await db.query.crawlJobs.findFirst({
    where: (jobs, { eq }) => eq(jobs.id, args.jobId),
    columns: {
      summaryData: true,
    },
  });

  const cachedSummary = crawl?.summaryData as CrawlSummaryData | null;
  if (cachedSummary) {
    return {
      projectName: args.projectName,
      projectId: args.projectId,
      jobId: args.jobId,
      score: cachedSummary.overallScore,
      grade: cachedSummary.letterGrade,
      issueCount: cachedSummary.issueCount,
      reportUrl: `${baseUrl}/dashboard/projects/${args.projectId}`,
    };
  }

  const [pageScores, issueCount] = await Promise.all([
    db.query.pageScores.findMany({
      where: (scores, { eq }) => eq(scores.jobId, args.jobId),
      columns: {
        overallScore: true,
        technicalScore: true,
        contentScore: true,
        aiReadinessScore: true,
        detail: true,
      },
    }),
    countIssuesForJob(db, args.jobId),
  ]);

  const aggregate =
    pageScores.length > 0 ? aggregatePageScores(pageScores) : null;

  return {
    projectName: args.projectName,
    projectId: args.projectId,
    jobId: args.jobId,
    score: aggregate?.overallScore ?? null,
    grade: aggregate?.letterGrade ?? null,
    issueCount,
    reportUrl: `${baseUrl}/dashboard/projects/${args.projectId}`,
  };
}

async function countIssuesForJob(db: Database, jobId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)` as any })
    .from(issues)
    .where(eq(issues.jobId, jobId) as any);
  return Number(rows[0]?.count ?? 0);
}

function normalizeBaseUrl(candidate?: string) {
  if (!candidate) return DEFAULT_APP_URL;
  return candidate.endsWith("/") ? candidate.slice(0, -1) : candidate;
}

function getSubject(type: string): string {
  if (type.includes("crawl_completed")) return "🚀 Your AI SEO Audit is Ready";
  if (type.includes("credit_alert"))
    return "⚠️ Action Required: Crawl Credits Low";
  if (type.includes("score_drop"))
    return "📉 Alert: LLM Citability Score Dropped";
  return "🔍 Competitor Alert: New Semantic Gaps Detected";
}

function renderTemplate(type: string, data: any): string {
  if (type.includes("crawl_completed")) {
    const projectName = data.projectName ?? "your project";
    const gradeSuffix = data.grade ? ` (${data.grade})` : "";
    const scoreLine =
      typeof data.score === "number"
        ? `<p>Score: ${data.score}/100${gradeSuffix}</p>`
        : "<p>Your new AI SEO audit is ready.</p>";
    const issueLine =
      typeof data.issueCount === "number"
        ? `<p>Found ${data.issueCount} issues to fix.</p>`
        : "";
    const reportUrl = resolveReportUrl(data);

    return `<h1>Crawl Completed for ${projectName}</h1>
            ${scoreLine}
            ${issueLine}
            <a href="${reportUrl}">View Full Report</a>`;
  }
  return `<p>New updates in your LLM Boost dashboard.</p>`;
}

function resolveReportUrl(data: any) {
  const candidate =
    typeof data.reportUrl === "string" ? data.reportUrl.trim() : "";
  if (candidate) return candidate;
  if (typeof data.projectId === "string" && data.projectId.length > 0) {
    return `${DEFAULT_APP_URL}/dashboard/projects/${data.projectId}`;
  }
  return DEFAULT_APP_URL;
}
