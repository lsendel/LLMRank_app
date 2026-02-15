import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReportData } from "../types";
import { SummaryReportPdf } from "./templates/summary";
import { DetailedReportPdf } from "./templates/detailed";

export async function renderPdf(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Buffer> {
  const element =
    type === "summary"
      ? React.createElement(SummaryReportPdf, { data })
      : React.createElement(DetailedReportPdf, { data });
  // renderToBuffer expects ReactElement<DocumentProps> but createElement returns a generic type.
  // The SummaryReportPdf/DetailedReportPdf components return <Document> so the cast is safe.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(element as any);
}
