import {
  createDb,
  projectQueries,
  scoreQueries,
  crawlQueries,
  type Database,
} from "@llm-boost/db";
import { SummaryGenerator } from "@llm-boost/llm";
import {
  getQuickWins,
  aggregatePageScores,
  type QuickWin,
} from "@llm-boost/shared";
import { toAggregateInput } from "./score-helpers";

export interface SummaryDataInput {
  databaseUrl: string;
  projectId: string;
  jobId: string;
}

export interface SummaryInput extends SummaryDataInput {
  anthropicApiKey: string;
}

export interface CrawlSummaryData {
  project: {
    id: string;
    name: string;
    domain: string;
  };
  overallScore: number;
  letterGrade: string;
  categoryScores: {
    technical: number;
    content: number;
    aiReadiness: number;
    performance: number;
  };
  quickWins: QuickWin[];
  pagesScored: number;
  generatedAt: string;
  issueCount: number;
}

export async function persistCrawlSummaryData(
  input: SummaryDataInput,
): Promise<CrawlSummaryData | null> {
  const db = createDb(input.databaseUrl);
  return persistSummaryWithDb(db, input);
}

/**
 * Generates an executive summary for a completed crawl job and stores it on
 * the crawl record. Also ensures the aggregate summary cache is up to date.
 */
export async function generateCrawlSummary(input: SummaryInput): Promise<void> {
  const db = createDb(input.databaseUrl);
  const summaryGenerator = new SummaryGenerator({
    anthropicApiKey: input.anthropicApiKey,
  });

  const summaryData = await persistSummaryWithDb(db, input);
  if (!summaryData) return;

  const summary = await summaryGenerator.generateExecutiveSummary({
    projectName: summaryData.project.name,
    domain: summaryData.project.domain,
    overallScore: summaryData.overallScore,
    categoryScores: summaryData.categoryScores,
    quickWins: summaryData.quickWins,
    pagesScored: summaryData.pagesScored,
  });

  await crawlQueries(db).updateSummary(input.jobId, summary);
}

async function persistSummaryWithDb(
  db: Database,
  input: SummaryDataInput,
): Promise<CrawlSummaryData | null> {
  const projectQuery = projectQueries(db);
  const scoreQuery = scoreQueries(db);
  const crawlQuery = crawlQueries(db);

  const [project, pageScores, issues] = await Promise.all([
    projectQuery.getById(input.projectId),
    scoreQuery.listByJob(input.jobId),
    scoreQuery.getIssuesByJob(input.jobId),
  ]);

  if (!project || pageScores.length === 0) {
    await crawlQuery.updateSummaryData(input.jobId, null);
    return null;
  }

  const agg = aggregatePageScores(toAggregateInput(pageScores));
  const quickWins = getQuickWins(issues ?? []);

  const summaryData: CrawlSummaryData = {
    project: { id: project.id, name: project.name, domain: project.domain },
    overallScore: agg.overallScore,
    letterGrade: agg.letterGrade,
    categoryScores: agg.scores,
    quickWins,
    pagesScored: pageScores.length,
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
  };

  await crawlQuery.updateSummaryData(input.jobId, summaryData);
  return summaryData;
}
