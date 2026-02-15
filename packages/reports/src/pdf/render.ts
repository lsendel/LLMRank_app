import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ReportData } from "../types";
import { SummaryReportPdf } from "./templates/summary";
import { DetailedReportPdf } from "./templates/detailed";

export async function renderPdf(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Uint8Array> {
  const element =
    type === "summary"
      ? React.createElement(SummaryReportPdf, { data })
      : React.createElement(DetailedReportPdf, { data });

  // renderToBuffer requires Node.js (runs on Fly.io, not CF Workers)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return new Uint8Array(buffer);
}
