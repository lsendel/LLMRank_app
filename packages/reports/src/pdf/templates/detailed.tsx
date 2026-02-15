import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ReportData, ReportIssue } from "../../types";
import { ReportHeader } from "../components/header";
import { ReportFooter } from "../components/footer";
import { Section } from "../components/section";
import { PdfScoreCircle } from "../charts/score-circle";
import { PdfRadarChart } from "../charts/radar-chart";
import { PdfLineChart } from "../charts/line-chart";
import { PdfBarChart } from "../charts/bar-chart";
import { PdfPieChart } from "../charts/pie-chart";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1f2937",
  },
  // Cover
  coverCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverTitle: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginTop: 16,
  },
  coverDomain: { fontSize: 14, color: "#4f46e5", marginTop: 4 },
  coverSubtitle: { fontSize: 11, color: "#6b7280", marginTop: 8 },
  preparedFor: { fontSize: 10, color: "#6b7280", marginTop: 24 },
  // Layout
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  // Score cards
  scoreCard: {
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    marginBottom: 4,
  },
  scoreLabel: { fontSize: 9, color: "#6b7280" },
  scoreValue: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  // Text
  summaryText: { fontSize: 10, lineHeight: 1.5, color: "#374151" },
  bodyText: { fontSize: 9, lineHeight: 1.4, color: "#374151" },
  // Quick wins
  quickWinRow: {
    padding: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
    marginBottom: 4,
  },
  quickWinTitle: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  quickWinRec: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  quickWinMeta: { fontSize: 8, color: "#4f46e5", marginTop: 2 },
  // Issues
  severityHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 6,
  },
  issueRow: {
    padding: 6,
    marginBottom: 3,
    backgroundColor: "#f9fafb",
    borderRadius: 3,
  },
  issueCode: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#6b7280" },
  issueMessage: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
    marginTop: 1,
  },
  issueRec: { fontSize: 8, color: "#6b7280", marginTop: 1 },
  issueMeta: { fontSize: 7, color: "#4f46e5", marginTop: 2 },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 4,
    borderRadius: 2,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: 4,
    borderBottom: "0.5 solid #e5e7eb",
  },
  tableCell: { fontSize: 8 },
  tableCellUrl: { flex: 4, fontSize: 8, color: "#374151" },
  tableCellScore: { flex: 1, fontSize: 8, textAlign: "center" },
  tableCellGrade: {
    flex: 1,
    fontSize: 8,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  tableCellIssues: { flex: 1, fontSize: 8, textAlign: "center" },
  // Action plan
  tierHeader: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 8,
  },
  tierDescription: { fontSize: 8, color: "#6b7280", marginBottom: 6 },
  actionItem: {
    padding: 6,
    marginBottom: 3,
    backgroundColor: "#f9fafb",
    borderRadius: 3,
  },
  actionRec: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1f2937" },
  actionMeta: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  // Content health
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 6,
    backgroundColor: "#f9fafb",
    borderRadius: 3,
    marginBottom: 3,
  },
  metricLabel: { fontSize: 9, color: "#6b7280" },
  metricValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1f2937" },
  // Competitor
  competitorRow: {
    padding: 6,
    marginBottom: 3,
    backgroundColor: "#f9fafb",
    borderRadius: 3,
  },
  competitorDomain: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
  },
  competitorDetail: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  // Platform opportunity
  platformRow: {
    padding: 8,
    marginBottom: 4,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  platformName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
  },
  platformScores: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  platformTip: { fontSize: 8, color: "#374151", marginTop: 1, paddingLeft: 8 },
  // Integration
  integrationMetric: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 4,
    borderBottom: "0.5 solid #e5e7eb",
  },
  integrationLabel: { fontSize: 8, color: "#6b7280" },
  integrationValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1f2937",
  },
});

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  warning: "#ea580c",
  info: "#2563eb",
};

const SEVERITY_ORDER = ["critical", "warning", "info"];

const GRADE_COLORS: Record<string, string> = {
  A: "#16a34a",
  B: "#2563eb",
  C: "#ca8a04",
  D: "#ea580c",
  F: "#dc2626",
};

function gradeColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 80) return "#2563eb";
  if (score >= 70) return "#ca8a04";
  if (score >= 60) return "#ea580c";
  return "#dc2626";
}

function truncateUrl(url: string, max: number = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 3) + "...";
}

function groupIssuesBySeverity(
  items: ReportIssue[],
): Record<string, ReportIssue[]> {
  const groups: Record<string, ReportIssue[]> = {};
  for (const item of items) {
    if (!groups[item.severity]) groups[item.severity] = [];
    groups[item.severity].push(item);
  }
  return groups;
}

interface ActionTier {
  title: string;
  description: string;
  items: ReportIssue[];
}

function buildActionPlan(issues: ReportIssue[]): ActionTier[] {
  const critical = issues.filter((i) => i.severity === "critical");
  // Split warnings into quick wins (high impact) and strategic
  const warnings = issues.filter((i) => i.severity === "warning");
  const quickWins = warnings.filter((i) => i.scoreImpact >= 3);
  const strategic = warnings.filter((i) => i.scoreImpact < 3);
  const info = issues.filter((i) => i.severity === "info");

  return [
    {
      title: "Priority 1: Critical Fixes",
      description:
        "Address immediately - these issues significantly harm your AI visibility.",
      items: critical,
    },
    {
      title: "Priority 2: Quick Wins",
      description: "High-impact changes that are relatively easy to implement.",
      items: quickWins,
    },
    {
      title: "Priority 3: Strategic Improvements",
      description: "Medium-term improvements for sustained visibility gains.",
      items: strategic,
    },
    {
      title: "Priority 4: Long-term Optimization",
      description: "Ongoing optimizations for marginal gains.",
      items: info,
    },
  ].filter((tier) => tier.items.length > 0);
}

export function DetailedReportPdf({ data }: { data: ReportData }) {
  const brandColor = data.config.brandingColor ?? "#4f46e5";
  const brandName = data.project.branding?.companyName;
  const categories = [
    { label: "Technical SEO", score: data.scores.technical },
    { label: "Content Quality", score: data.scores.content },
    { label: "AI Readiness", score: data.scores.aiReadiness },
    { label: "Performance", score: data.scores.performance },
  ];

  const issueGroups = groupIssuesBySeverity(data.issues.items);
  const actionPlan = buildActionPlan(data.issues.items);
  const worstPages = [...data.pages]
    .sort((a, b) => a.overall - b.overall)
    .slice(0, 20);

  return (
    <Document>
      {/* ── Page 1: Cover ── */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} />
        <View style={styles.coverCenter}>
          <PdfScoreCircle score={data.scores.overall} size={180} />
          <Text style={styles.coverTitle}>AI-Readiness Report</Text>
          <Text style={styles.coverDomain}>{data.project.domain}</Text>
          <Text style={styles.coverSubtitle}>
            {data.crawl.pagesScored} pages analyzed | {data.scores.letterGrade}{" "}
            Grade | Detailed Analysis
          </Text>
          {data.config.preparedFor && (
            <Text style={styles.preparedFor}>
              Prepared for {data.config.preparedFor}
            </Text>
          )}
        </View>
        <ReportFooter brandName={brandName} />
      </Page>

      {/* ── Page 2: Category Scorecard + Executive Summary ── */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />

        <Section title="Category Scorecard">
          <View style={styles.row}>
            <View style={styles.col}>
              <PdfRadarChart scores={data.scores} size={180} />
            </View>
            <View style={styles.col}>
              {categories.map((cat) => (
                <View key={cat.label} style={styles.scoreCard}>
                  <Text style={styles.scoreLabel}>{cat.label}</Text>
                  <Text
                    style={[
                      styles.scoreValue,
                      { color: gradeColor(cat.score) },
                    ]}
                  >
                    {Math.round(cat.score)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Section>

        {data.crawl.summary && (
          <Section title="Executive Summary">
            <Text style={styles.summaryText}>{data.crawl.summary}</Text>
          </Section>
        )}

        <Section title="Issues Overview">
          <View style={styles.row}>
            <View style={styles.col}>
              <PdfPieChart
                data={data.issues.bySeverity.map((s) => ({
                  label:
                    s.severity.charAt(0).toUpperCase() + s.severity.slice(1),
                  value: s.count,
                  color: SEVERITY_COLORS[s.severity] ?? "#9ca3af",
                }))}
                size={140}
                title="By Severity"
              />
            </View>
            <View style={styles.col}>
              <PdfBarChart
                data={data.issues.byCategory.map((c) => ({
                  label:
                    c.category.charAt(0).toUpperCase() + c.category.slice(1),
                  value: c.count,
                }))}
                width={260}
                height={140}
                title="By Category"
              />
            </View>
          </View>
        </Section>

        <ReportFooter brandName={brandName} />
      </Page>

      {/* ── Page 3: Quick Wins with ROI ── */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />

        <Section
          title="Quick Wins"
          subtitle="Top recommendations sorted by impact-to-effort ratio"
        >
          {data.quickWins.slice(0, 10).map((win, i) => (
            <View key={i} style={styles.quickWinRow}>
              <Text style={styles.quickWinTitle}>
                {i + 1}. {win.message}
              </Text>
              <Text style={styles.quickWinRec}>{win.recommendation}</Text>
              <Text style={styles.quickWinMeta}>
                +{win.scoreImpact} pts | {win.affectedPages} pages | Effort:{" "}
                {win.effort} | Visibility: {win.roi.visibilityImpact}
                {win.roi.trafficEstimate ? ` | ${win.roi.trafficEstimate}` : ""}
              </Text>
            </View>
          ))}
        </Section>

        <ReportFooter brandName={brandName} />
      </Page>

      {/* ── Page 4: Score Trend (if history) ── */}
      {data.history.length > 1 && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          <Section
            title="Score Trend"
            subtitle="Overall score progression across crawls"
          >
            <PdfLineChart
              series={[
                {
                  name: "Overall",
                  data: data.history.map((h) => ({
                    label: new Date(h.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: h.overall,
                  })),
                  color: "#4f46e5",
                },
              ]}
              width={500}
              height={200}
            />
          </Section>

          <Section title="Category Trends">
            <PdfLineChart
              series={[
                {
                  name: "Technical",
                  data: data.history.map((h) => ({
                    label: new Date(h.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: h.technical,
                  })),
                  color: "#2563eb",
                },
                {
                  name: "Content",
                  data: data.history.map((h) => ({
                    label: new Date(h.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: h.content,
                  })),
                  color: "#16a34a",
                },
                {
                  name: "AI Readiness",
                  data: data.history.map((h) => ({
                    label: new Date(h.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: h.aiReadiness,
                  })),
                  color: "#ca8a04",
                },
                {
                  name: "Performance",
                  data: data.history.map((h) => ({
                    label: new Date(h.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }),
                    value: h.performance,
                  })),
                  color: "#ea580c",
                },
              ]}
              width={500}
              height={220}
            />
          </Section>

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* ── Page 5: AI Visibility Snapshot ── */}
      {data.visibility && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          <Section
            title="AI Visibility Snapshot"
            subtitle="How your brand appears across AI platforms"
          >
            <PdfBarChart
              data={data.visibility.platforms.map((p) => ({
                label: p.provider.charAt(0).toUpperCase() + p.provider.slice(1),
                value: p.brandMentionRate,
                color: brandColor,
              }))}
              width={450}
              height={140}
              title="Brand Mention Rate (%)"
            />
          </Section>

          <Section title="Platform Details">
            {data.visibility.platforms.map((p, i) => (
              <View key={i} style={styles.metricRow}>
                <Text style={styles.metricLabel}>
                  {p.provider.charAt(0).toUpperCase() + p.provider.slice(1)}
                </Text>
                <Text style={styles.metricValue}>
                  Mentions: {p.brandMentionRate}% | Citations:{" "}
                  {p.urlCitationRate}%
                  {p.avgPosition
                    ? ` | Avg Position: ${p.avgPosition.toFixed(1)}`
                    : ""}
                  {` | ${p.checksCount} checks`}
                </Text>
              </View>
            ))}
          </Section>

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* ── Issue Catalog (grouped by severity -> category) ── */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />

        <Section
          title="Issue Catalog"
          subtitle={`${data.issues.total} issues found across ${data.crawl.pagesScored} pages`}
        >
          <Text style={styles.bodyText}>
            Issues are grouped by severity level. Each issue includes a
            recommendation and estimated impact.
          </Text>
        </Section>

        {SEVERITY_ORDER.map((severity) => {
          const group = issueGroups[severity];
          if (!group || group.length === 0) return null;
          return (
            <View key={severity}>
              <Text
                style={[
                  styles.severityHeader,
                  { color: SEVERITY_COLORS[severity] ?? "#374151" },
                ]}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)} (
                {group.length})
              </Text>
              {group.map((issue, i) => (
                <View key={i} style={styles.issueRow} wrap={false}>
                  <Text style={styles.issueCode}>
                    {issue.code} | {issue.category}
                  </Text>
                  <Text style={styles.issueMessage}>{issue.message}</Text>
                  <Text style={styles.issueRec}>{issue.recommendation}</Text>
                  <Text style={styles.issueMeta}>
                    {issue.affectedPages} pages | -{issue.scoreImpact} pts
                    {issue.roi
                      ? ` | Visibility: ${issue.roi.visibilityImpact}`
                      : ""}
                    {issue.roi?.trafficEstimate
                      ? ` | ${issue.roi.trafficEstimate}`
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <ReportFooter brandName={brandName} />
      </Page>

      {/* ── Worst Pages Table ── */}
      {worstPages.length > 0 && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          <Section
            title="Lowest Scoring Pages"
            subtitle="Top 20 pages that need the most attention"
          >
            <View style={styles.tableHeader}>
              <Text
                style={[styles.tableCellUrl, { fontFamily: "Helvetica-Bold" }]}
              >
                URL
              </Text>
              <Text
                style={[
                  styles.tableCellScore,
                  { fontFamily: "Helvetica-Bold" },
                ]}
              >
                Score
              </Text>
              <Text
                style={[
                  styles.tableCellGrade,
                  { fontFamily: "Helvetica-Bold" },
                ]}
              >
                Grade
              </Text>
              <Text
                style={[
                  styles.tableCellIssues,
                  { fontFamily: "Helvetica-Bold" },
                ]}
              >
                Issues
              </Text>
            </View>
            {worstPages.map((page, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tableCellUrl}>{truncateUrl(page.url)}</Text>
                <Text
                  style={[
                    styles.tableCellScore,
                    { color: gradeColor(page.overall) },
                  ]}
                >
                  {Math.round(page.overall)}
                </Text>
                <Text
                  style={[
                    styles.tableCellGrade,
                    { color: GRADE_COLORS[page.grade] ?? "#374151" },
                  ]}
                >
                  {page.grade}
                </Text>
                <Text style={styles.tableCellIssues}>{page.issueCount}</Text>
              </View>
            ))}
          </Section>

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* ── Grade Distribution ── */}
      {data.gradeDistribution.length > 0 && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          <Section
            title="Grade Distribution"
            subtitle="Distribution of page grades across your site"
          >
            <PdfBarChart
              data={data.gradeDistribution.map((g) => ({
                label: `${g.grade} (${g.count})`,
                value: g.percentage,
                color: GRADE_COLORS[g.grade] ?? "#9ca3af",
              }))}
              width={450}
              height={160}
              title="Pages by Grade (%)"
            />
          </Section>

          {/* Content Health Metrics */}
          {data.contentHealth && (
            <Section
              title="Content Health Metrics"
              subtitle="Aggregate content quality signals"
            >
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Average Word Count</Text>
                <Text style={styles.metricValue}>
                  {Math.round(data.contentHealth.avgWordCount)}
                </Text>
              </View>
              {data.contentHealth.avgClarity !== null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Clarity Score</Text>
                  <Text style={styles.metricValue}>
                    {data.contentHealth.avgClarity.toFixed(1)}
                  </Text>
                </View>
              )}
              {data.contentHealth.avgAuthority !== null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Authority Score</Text>
                  <Text style={styles.metricValue}>
                    {data.contentHealth.avgAuthority.toFixed(1)}
                  </Text>
                </View>
              )}
              {data.contentHealth.avgComprehensiveness !== null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Comprehensiveness</Text>
                  <Text style={styles.metricValue}>
                    {data.contentHealth.avgComprehensiveness.toFixed(1)}
                  </Text>
                </View>
              )}
              {data.contentHealth.avgStructure !== null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Structure Score</Text>
                  <Text style={styles.metricValue}>
                    {data.contentHealth.avgStructure.toFixed(1)}
                  </Text>
                </View>
              )}
              {data.contentHealth.avgCitationWorthiness !== null && (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Citation Worthiness</Text>
                  <Text style={styles.metricValue}>
                    {data.contentHealth.avgCitationWorthiness.toFixed(1)}
                  </Text>
                </View>
              )}
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Pages Above Threshold</Text>
                <Text style={styles.metricValue}>
                  {data.contentHealth.pagesAboveThreshold} /{" "}
                  {data.contentHealth.totalPages}
                </Text>
              </View>
            </Section>
          )}

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* ── Competitor Analysis ── */}
      {data.competitors && data.competitors.length > 0 && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          <Section
            title="Competitor Analysis"
            subtitle="Domains that appear alongside your brand in AI responses"
          >
            {data.competitors.map((comp, i) => (
              <View key={i} style={styles.competitorRow}>
                <Text style={styles.competitorDomain}>{comp.domain}</Text>
                <Text style={styles.competitorDetail}>
                  {comp.mentionCount} mentions across{" "}
                  {comp.platforms.join(", ")}
                </Text>
                {comp.queries.length > 0 && (
                  <Text style={styles.competitorDetail}>
                    Top queries: {comp.queries.slice(0, 3).join(", ")}
                  </Text>
                )}
              </View>
            ))}
          </Section>

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* ── Platform Opportunities ── */}
      {data.platformOpportunities && data.platformOpportunities.length > 0 && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          <Section
            title="Platform Opportunities"
            subtitle="Platform-specific optimization recommendations"
          >
            {data.platformOpportunities.map((plat, i) => (
              <View key={i} style={styles.platformRow}>
                <Text style={styles.platformName}>{plat.platform}</Text>
                <Text style={styles.platformScores}>
                  Current: {Math.round(plat.currentScore)} | Opportunity:{" "}
                  {Math.round(plat.opportunityScore)}
                </Text>
                {plat.topTips.map((tip, j) => (
                  <Text key={j} style={styles.platformTip}>
                    - {tip}
                  </Text>
                ))}
              </View>
            ))}
          </Section>

          <ReportFooter brandName={brandName} />
        </Page>
      )}

      {/* ── Action Plan ── */}
      <Page size="A4" style={styles.page}>
        <ReportHeader data={data} compact />

        <Section
          title="Action Plan"
          subtitle="Prioritized roadmap for improving your AI readiness score"
        >
          <Text style={styles.bodyText}>
            Based on the {data.issues.total} issues identified, here is a 4-tier
            action plan organized by priority and impact.
          </Text>
        </Section>

        {actionPlan.map((tier, ti) => (
          <View key={ti}>
            <Text style={styles.tierHeader}>{tier.title}</Text>
            <Text style={styles.tierDescription}>{tier.description}</Text>
            {tier.items.slice(0, 10).map((item, i) => (
              <View key={i} style={styles.actionItem} wrap={false}>
                <Text style={styles.actionRec}>{item.recommendation}</Text>
                <Text style={styles.actionMeta}>
                  {item.affectedPages} pages | -{item.scoreImpact} pts impact
                  {item.roi
                    ? ` | Visibility: ${item.roi.visibilityImpact}`
                    : ""}
                  {item.roi?.trafficEstimate
                    ? ` | ${item.roi.trafficEstimate}`
                    : ""}
                </Text>
              </View>
            ))}
            {tier.items.length > 10 && (
              <Text style={styles.bodyText}>
                ...and {tier.items.length - 10} more items
              </Text>
            )}
          </View>
        ))}

        <ReportFooter brandName={brandName} />
      </Page>

      {/* ── Integration Data ── */}
      {data.integrations && (
        <Page size="A4" style={styles.page}>
          <ReportHeader data={data} compact />

          {data.integrations.gsc && (
            <Section
              title="Google Search Console Data"
              subtitle="Top search queries driving traffic to your site"
            >
              <View style={styles.tableHeader}>
                <Text
                  style={[
                    styles.tableCellUrl,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  Query
                </Text>
                <Text
                  style={[
                    styles.tableCellScore,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  Impressions
                </Text>
                <Text
                  style={[
                    styles.tableCellScore,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  Clicks
                </Text>
                <Text
                  style={[
                    styles.tableCellScore,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  Position
                </Text>
              </View>
              {data.integrations.gsc.topQueries.slice(0, 15).map((q, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tableCellUrl}>
                    {truncateUrl(q.query, 40)}
                  </Text>
                  <Text style={styles.tableCellScore}>
                    {q.impressions.toLocaleString()}
                  </Text>
                  <Text style={styles.tableCellScore}>
                    {q.clicks.toLocaleString()}
                  </Text>
                  <Text style={styles.tableCellScore}>
                    {q.position.toFixed(1)}
                  </Text>
                </View>
              ))}
            </Section>
          )}

          {data.integrations.ga4 && (
            <Section title="Google Analytics Data">
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Bounce Rate</Text>
                <Text style={styles.metricValue}>
                  {(data.integrations.ga4.bounceRate * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Avg Engagement Time</Text>
                <Text style={styles.metricValue}>
                  {data.integrations.ga4.avgEngagement.toFixed(0)}s
                </Text>
              </View>
              {data.integrations.ga4.topPages.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text
                    style={[
                      styles.bodyText,
                      { fontFamily: "Helvetica-Bold", marginBottom: 4 },
                    ]}
                  >
                    Top Pages by Sessions
                  </Text>
                  {data.integrations.ga4.topPages.slice(0, 10).map((p, i) => (
                    <View key={i} style={styles.integrationMetric}>
                      <Text style={styles.integrationLabel}>
                        {truncateUrl(p.url, 60)}
                      </Text>
                      <Text style={styles.integrationValue}>
                        {p.sessions.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>
          )}

          {data.integrations.clarity && (
            <Section title="Microsoft Clarity Data">
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Average UX Score</Text>
                <Text style={styles.metricValue}>
                  {data.integrations.clarity.avgUxScore.toFixed(1)}
                </Text>
              </View>
              {data.integrations.clarity.rageClickPages.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text
                    style={[
                      styles.bodyText,
                      { fontFamily: "Helvetica-Bold", marginBottom: 4 },
                    ]}
                  >
                    Pages with Rage Clicks
                  </Text>
                  {data.integrations.clarity.rageClickPages
                    .slice(0, 10)
                    .map((url, i) => (
                      <Text key={i} style={styles.bodyText}>
                        {truncateUrl(url, 70)}
                      </Text>
                    ))}
                </View>
              )}
            </Section>
          )}

          <ReportFooter brandName={brandName} />
        </Page>
      )}
    </Document>
  );
}
