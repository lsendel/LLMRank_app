import { describe, it, expect, vi, beforeEach } from "vitest";
import { competitorBenchmarkQueries } from "../../queries/competitor-benchmarks";

// ---------------------------------------------------------------------------
// Mock DB builder – chainable drizzle-like object
// ---------------------------------------------------------------------------

function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.groupBy = vi.fn().mockReturnValue(chain);

  chain.then = vi.fn().mockImplementation((resolve: any) => resolve([]));

  const queryHandlers: Record<
    string,
    Record<string, ReturnType<typeof vi.fn>>
  > = {};
  const queryProxy = new Proxy(
    {},
    {
      get(_target, tableName: string) {
        if (!queryHandlers[tableName]) {
          queryHandlers[tableName] = {
            findFirst: vi.fn().mockResolvedValue(undefined),
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        return queryHandlers[tableName];
      },
    },
  );

  return { chain, queryHandlers, db: { ...chain, query: queryProxy } as any };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("competitorBenchmarkQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof competitorBenchmarkQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = competitorBenchmarkQueries(mock.db);
  });

  // --- create ---
  it("create inserts and returns benchmark", async () => {
    const benchmark = {
      id: "cb1",
      projectId: "p1",
      competitorDomain: "competitor.com",
      overallScore: 85,
      technicalScore: 90,
      contentScore: 80,
      aiReadinessScore: 82,
      performanceScore: 88,
      letterGrade: "B",
      issueCount: 5,
      topIssues: ["MISSING_LLMS_TXT", "SLOW_LCP"],
    };
    mock.chain.returning.mockResolvedValueOnce([benchmark]);

    const result = await queries.create({
      projectId: "p1",
      competitorDomain: "competitor.com",
      overallScore: 85,
      technicalScore: 90,
      contentScore: 80,
      aiReadinessScore: 82,
      performanceScore: 88,
      letterGrade: "B",
      issueCount: 5,
      topIssues: ["MISSING_LLMS_TXT", "SLOW_LCP"],
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        competitorDomain: "competitor.com",
        overallScore: 85,
      }),
    );
    expect(result).toEqual(benchmark);
  });

  // --- listByProject ---
  it("listByProject calls findMany with projectId", async () => {
    const benchmarks = [
      { id: "cb1", projectId: "p1", competitorDomain: "a.com" },
      { id: "cb2", projectId: "p1", competitorDomain: "b.com" },
    ];
    mock.db.query.competitorBenchmarks.findMany.mockResolvedValueOnce(
      benchmarks,
    );

    const result = await queries.listByProject("p1");

    expect(mock.db.query.competitorBenchmarks.findMany).toHaveBeenCalled();
    expect(result).toEqual(benchmarks);
    expect(result).toHaveLength(2);
  });

  // --- getLatest ---
  it("getLatest calls findFirst with projectId and domain", async () => {
    const benchmark = {
      id: "cb1",
      projectId: "p1",
      competitorDomain: "competitor.com",
      overallScore: 85,
    };
    mock.db.query.competitorBenchmarks.findFirst.mockResolvedValueOnce(
      benchmark,
    );

    const result = await queries.getLatest("p1", "competitor.com");

    expect(mock.db.query.competitorBenchmarks.findFirst).toHaveBeenCalled();
    expect(result).toEqual(benchmark);
  });

  it("getLatest returns undefined when not found", async () => {
    mock.db.query.competitorBenchmarks.findFirst.mockResolvedValueOnce(
      undefined,
    );

    const result = await queries.getLatest("p1", "unknown.com");

    expect(result).toBeUndefined();
  });
});
