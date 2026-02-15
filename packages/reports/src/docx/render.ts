import { Packer } from "docx";
import type { ReportData } from "../types";
import { buildSummaryDocx } from "./templates/summary";
import { buildDetailedDocx } from "./templates/detailed";

export async function renderDocx(
  data: ReportData,
  type: "summary" | "detailed",
): Promise<Uint8Array> {
  const doc =
    type === "summary" ? buildSummaryDocx(data) : buildDetailedDocx(data);
  // toBuffer() requires Node.js (runs on Fly.io, not CF Workers)
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
