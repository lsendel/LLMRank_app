import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createDb, reports, eq } from "@llm-boost/db";
import { renderPdf, renderDocx, aggregateReportData } from "@llm-boost/reports";
import type { GenerateReportJob } from "@llm-boost/reports";
import { fetchReportData } from "./data-fetcher";

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const DATABASE_URL = process.env.DATABASE_URL!;
const SHARED_SECRET = process.env.SHARED_SECRET!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "ai-seo-storage";

// ---------------------------------------------------------------------------
// S3 client for R2
// ---------------------------------------------------------------------------

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

// ---------------------------------------------------------------------------
// HMAC verification
// ---------------------------------------------------------------------------

const MAX_TIMESTAMP_DRIFT_S = 300; // 5 minutes

async function verifyHmac(
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_S) return false;

  const prefix = "hmac-sha256=";
  if (!signature.startsWith(prefix)) return false;
  const providedHex = signature.slice(prefix.length);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SHARED_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}${body}`),
  );
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return providedHex === expectedHex;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = new Hono();

app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Generate report
app.post("/generate", async (c) => {
  const signature = c.req.header("X-Signature");
  const timestamp = c.req.header("X-Timestamp");
  const body = await c.req.text();

  if (!signature || !timestamp) {
    return c.json({ error: "Missing auth headers" }, 401);
  }

  const valid = await verifyHmac(signature, timestamp, body);
  if (!valid) {
    return c.json({ error: "Invalid HMAC signature" }, 401);
  }

  const job: GenerateReportJob = JSON.parse(body);
  const db = createDb(DATABASE_URL);

  // Respond immediately — process in the background
  // (Fly.io keeps the process alive, unlike CF Workers)
  const responsePromise = (async () => {
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

      // Upload to R2 via S3 API
      const r2Key = `reports/${job.projectId}/${job.reportId}.${job.format}`;
      const contentType =
        job.format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

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

      console.log(`Report ${job.reportId} generated successfully (${r2Key})`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Report ${job.reportId} failed:`, errorMsg);

      await db
        .update(reports)
        .set({ status: "failed", error: errorMsg })
        .where(eq(reports.id, job.reportId));
    }
  })();

  // Don't await — respond 202 Accepted immediately
  responsePromise.catch((e) => console.error("Background task error:", e));

  return c.json({ accepted: true, reportId: job.reportId }, 202);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

console.log(`Report service starting on port ${PORT}`);
serve({ fetch: app.fetch, port: PORT });
