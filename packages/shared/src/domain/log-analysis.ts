import { z } from "zod";

// ─── Value Objects (immutable, no identity) ─────────────────────────

/** Known AI and search engine crawler user-agent patterns. */
export const AI_CRAWLER_PATTERNS: ReadonlyArray<{
  pattern: string;
  label: string;
}> = [
  { pattern: "gptbot", label: "GPTBot (OpenAI)" },
  { pattern: "chatgpt", label: "ChatGPT-User" },
  { pattern: "claudebot", label: "ClaudeBot (Anthropic)" },
  { pattern: "anthropic", label: "Anthropic" },
  { pattern: "perplexitybot", label: "PerplexityBot" },
  { pattern: "google-extended", label: "Google Extended" },
  { pattern: "googleother", label: "Google Other" },
  { pattern: "googlebot", label: "Googlebot" },
  { pattern: "bingbot", label: "Bingbot" },
  { pattern: "applebot", label: "Applebot" },
  { pattern: "semrush", label: "SEMrush" },
  { pattern: "ahrefs", label: "Ahrefs" },
  { pattern: "bytespider", label: "ByteSpider (TikTok)" },
  { pattern: "ccbot", label: "CCBot (CommonCrawl)" },
] as const;

/** Classify a user-agent string into a known bot or "Unknown". */
export function classifyBot(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  for (const { pattern, label } of AI_CRAWLER_PATTERNS) {
    if (ua.includes(pattern)) return label;
  }
  return "Unknown";
}

/** Determine if a user-agent is a known crawler. */
export function isCrawler(userAgent: string): boolean {
  return classifyBot(userAgent) !== "Unknown";
}

// ─── Zod Schemas for Log Upload ─────────────────────────────────────

/** Schema for a single parsed log entry. */
export const LogEntrySchema = z.object({
  ip: z.string(),
  timestamp: z.string(),
  method: z.string(),
  path: z.string(),
  statusCode: z.number().int(),
  userAgent: z.string(),
  responseSize: z.number().int(),
  botLabel: z.string(),
  isCrawler: z.boolean(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

/** Combined log format regex (Apache/Nginx). */
export const COMBINED_LOG_REGEX =
  /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)]\s+"(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH)\s+([^?"]+)(?:\?[^"]*)?\s+HTTP\/[0-9.]+"\s+(\d{3})\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"/;

/** Parse a single line of Apache/Nginx combined log format. */
export function parseLogLine(line: string): LogEntry | null {
  const match = line.match(COMBINED_LOG_REGEX);
  if (!match) return null;

  const [, ip, timestamp, method, path, status, size, , userAgent] = match;
  const botLabel = classifyBot(userAgent);

  return {
    ip,
    timestamp,
    method,
    path,
    statusCode: parseInt(status, 10),
    userAgent,
    responseSize: parseInt(size, 10),
    botLabel,
    isCrawler: botLabel !== "Unknown",
  };
}

/** Stats summary — immutable value object. */
export interface LogAnalysisSummary {
  totalRequests: number;
  crawlerRequests: number;
  uniqueIPs: number;
  botBreakdown: Array<{ bot: string; count: number }>;
  statusBreakdown: Array<{ status: number; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

/** Compute summary statistics from parsed log entries. */
export function summarizeLogs(entries: LogEntry[]): LogAnalysisSummary {
  const crawlerEntries = entries.filter((e) => e.isCrawler);
  const uniqueIPs = new Set(entries.map((e) => e.ip)).size;

  const botCounts = new Map<string, number>();
  for (const e of crawlerEntries) {
    botCounts.set(e.botLabel, (botCounts.get(e.botLabel) ?? 0) + 1);
  }
  const botBreakdown = [...botCounts.entries()]
    .map(([bot, count]) => ({ bot, count }))
    .sort((a, b) => b.count - a.count);

  const statusCounts = new Map<number, number>();
  for (const e of entries) {
    statusCounts.set(e.statusCode, (statusCounts.get(e.statusCode) ?? 0) + 1);
  }
  const statusBreakdown = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const pathCounts = new Map<string, number>();
  for (const e of crawlerEntries) {
    pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);
  }
  const topPaths = [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalRequests: entries.length,
    crawlerRequests: crawlerEntries.length,
    uniqueIPs,
    botBreakdown,
    statusBreakdown,
    topPaths,
  };
}
