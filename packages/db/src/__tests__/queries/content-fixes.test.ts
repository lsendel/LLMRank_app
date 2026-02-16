import { describe, it, expect, vi, beforeEach } from "vitest";
import { contentFixQueries } from "../../queries/content-fixes";

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

describe("contentFixQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof contentFixQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = contentFixQueries(mock.db);
  });

  // --- create ---
  it("create inserts and returns fix", async () => {
    const fix = {
      id: "cf1",
      projectId: "p1",
      userId: "u1",
      pageId: "pg1",
      issueCode: "MISSING_META_DESC",
      originalContent: "old",
      fixedContent: "new",
      status: "pending",
    };
    mock.chain.returning.mockResolvedValueOnce([fix]);

    const result = await queries.create({
      projectId: "p1",
      userId: "u1",
      pageId: "pg1",
      issueCode: "MISSING_META_DESC",
      originalContent: "old",
      fixedContent: "new",
    } as any);

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalled();
    expect(result).toEqual(fix);
  });

  // --- listByProject ---
  it("listByProject calls findMany with projectId and limit", async () => {
    const fixes = [
      { id: "cf1", projectId: "p1" },
      { id: "cf2", projectId: "p1" },
    ];
    mock.db.query.contentFixes.findMany.mockResolvedValueOnce(fixes);

    const result = await queries.listByProject("p1", 10);

    expect(mock.db.query.contentFixes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
    expect(result).toEqual(fixes);
    expect(result).toHaveLength(2);
  });

  it("listByProject uses default limit of 20", async () => {
    mock.db.query.contentFixes.findMany.mockResolvedValueOnce([]);

    await queries.listByProject("p1");

    expect(mock.db.query.contentFixes.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  // --- countByUserThisMonth ---
  it("countByUserThisMonth returns count from SQL result", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) =>
      resolve([{ count: 5 }]),
    );

    const result = await queries.countByUserThisMonth("u1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  it("countByUserThisMonth returns 0 when no rows", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.countByUserThisMonth("u-empty");

    expect(result).toBe(0);
  });

  // --- updateStatus ---
  it("updateStatus updates and returns row", async () => {
    const updated = { id: "cf1", status: "applied" };
    mock.chain.returning.mockResolvedValueOnce([updated]);

    const result = await queries.updateStatus("cf1", "applied");

    expect(mock.chain.update).toHaveBeenCalled();
    expect(mock.chain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "applied" }),
    );
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(updated);
  });
});
