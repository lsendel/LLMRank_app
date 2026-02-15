import { describe, it, expect } from "vitest";
import { GenerateReportSchema, ReportConfigSchema } from "../schemas/report";

describe("GenerateReportSchema", () => {
  it("accepts valid summary report request", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "summary",
      format: "pdf",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid detailed report with config", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "detailed",
      format: "docx",
      config: {
        compareCrawlIds: ["550e8400-e29b-41d4-a716-446655440002"],
        preparedFor: "Acme Corp",
        brandingColor: "#4F46E5",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid report type", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "invalid",
      format: "pdf",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid format", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "summary",
      format: "html",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = GenerateReportSchema.safeParse({
      type: "summary",
      format: "pdf",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid branding color format", () => {
    const result = GenerateReportSchema.safeParse({
      projectId: "550e8400-e29b-41d4-a716-446655440000",
      crawlJobId: "550e8400-e29b-41d4-a716-446655440001",
      type: "summary",
      format: "pdf",
      config: { brandingColor: "not-a-color" },
    });
    expect(result.success).toBe(false);
  });
});

describe("ReportConfigSchema", () => {
  it("accepts empty config", () => {
    const result = ReportConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid logo URL", () => {
    const result = ReportConfigSchema.safeParse({
      brandingLogoUrl: "https://example.com/logo.png",
    });
    expect(result.success).toBe(true);
  });

  it("limits compareCrawlIds to 10", () => {
    const ids = Array(11).fill("550e8400-e29b-41d4-a716-446655440000");
    const result = ReportConfigSchema.safeParse({ compareCrawlIds: ids });
    expect(result.success).toBe(false);
  });
});
