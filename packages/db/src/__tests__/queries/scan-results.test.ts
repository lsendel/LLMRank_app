import { describe, it, expect, vi, beforeEach } from "vitest";
import { scanResultQueries } from "../../queries/scan-results";

// ---------------------------------------------------------------------------
// Mock DB builder
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

describe("scanResultQueries", () => {
  let mock: ReturnType<typeof createMockDb>;
  let queries: ReturnType<typeof scanResultQueries>;

  beforeEach(() => {
    mock = createMockDb();
    queries = scanResultQueries(mock.db);
  });

  // --- create ---
  it("create inserts with 30-day expiry and returns result", async () => {
    const scanResult = {
      id: "sr1",
      domain: "example.com",
      url: "https://example.com/",
      scores: { overall: 85 },
      issues: [{ code: "MISSING_TITLE" }],
      quickWins: [],
      expiresAt: new Date(),
    };
    mock.chain.returning.mockResolvedValueOnce([scanResult]);

    const result = await queries.create({
      domain: "example.com",
      url: "https://example.com/",
      scores: { overall: 85 },
      issues: [{ code: "MISSING_TITLE" }],
      quickWins: [],
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(mock.chain.values).toHaveBeenCalled();
    expect(result).toEqual(scanResult);
  });

  it("create passes ipHash when provided", async () => {
    const scanResult = {
      id: "sr2",
      domain: "example.com",
      url: "https://example.com/",
      scores: { overall: 70 },
      issues: [],
      quickWins: [],
      ipHash: "abc123hash",
      expiresAt: new Date(),
    };
    mock.chain.returning.mockResolvedValueOnce([scanResult]);

    const result = await queries.create({
      domain: "example.com",
      url: "https://example.com/",
      scores: { overall: 70 },
      issues: [],
      quickWins: [],
      ipHash: "abc123hash",
    });

    expect(mock.chain.insert).toHaveBeenCalled();
    expect(result).toEqual(scanResult);
  });

  // --- getById ---
  it("getById returns result when found", async () => {
    const scanResult = {
      id: "sr1",
      domain: "example.com",
      url: "https://example.com/",
      scores: { overall: 85 },
    };
    mock.chain.then.mockImplementationOnce((resolve: any) =>
      resolve([scanResult]),
    );

    const result = await queries.getById("sr1");

    expect(mock.chain.select).toHaveBeenCalled();
    expect(mock.chain.from).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(result).toEqual(scanResult);
  });

  it("getById returns null when not found", async () => {
    mock.chain.then.mockImplementationOnce((resolve: any) => resolve([]));

    const result = await queries.getById("sr-none");

    expect(result).toBeNull();
  });

  // --- deleteExpired ---
  it("deleteExpired returns count of deleted rows", async () => {
    const deletedRows = [{ id: "sr1" }, { id: "sr2" }, { id: "sr3" }];
    mock.chain.returning.mockResolvedValueOnce(deletedRows);

    const result = await queries.deleteExpired();

    expect(mock.chain.delete).toHaveBeenCalled();
    expect(mock.chain.where).toHaveBeenCalled();
    expect(mock.chain.returning).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  it("deleteExpired returns 0 when nothing expired", async () => {
    mock.chain.returning.mockResolvedValueOnce([]);

    const result = await queries.deleteExpired();

    expect(result).toBe(0);
  });
});
