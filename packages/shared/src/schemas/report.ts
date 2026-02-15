import { z } from "zod";

export const ReportConfigSchema = z.object({
  compareCrawlIds: z.array(z.string().uuid()).max(10).optional(),
  brandingLogoUrl: z.string().url().optional(),
  brandingColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  preparedFor: z.string().max(200).optional(),
  includeSections: z.array(z.string()).optional(),
});

export const GenerateReportSchema = z.object({
  projectId: z.string().uuid(),
  crawlJobId: z.string().uuid(),
  type: z.enum(["summary", "detailed"]),
  format: z.enum(["pdf", "docx"]),
  config: ReportConfigSchema.optional(),
});

export type GenerateReportInput = z.infer<typeof GenerateReportSchema>;
export type ReportConfig = z.infer<typeof ReportConfigSchema>;

export type ReportType = "summary" | "detailed";
export type ReportFormat = "pdf" | "docx";
export type ReportStatus = "queued" | "generating" | "complete" | "failed";

export interface ReportMeta {
  id: string;
  projectId: string;
  crawlJobId: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  r2Key: string | null;
  fileSize: number | null;
  config: ReportConfig;
  error: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}
