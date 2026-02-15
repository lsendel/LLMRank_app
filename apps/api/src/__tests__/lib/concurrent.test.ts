import { describe, it, expect } from "vitest";
import { pMap } from "../../lib/concurrent";

describe("pMap", () => {
  it("processes items with limited concurrency", async () => {
    let running = 0;
    let maxRunning = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    const results = await pMap(
      items,
      async (item) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
        return item * 2;
      },
      { concurrency: 3 },
    );

    expect(results).toEqual(items.map((i) => i * 2));
    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it("handles errors without stopping other items when settle=true", async () => {
    const items = [1, 2, 3];
    const results = await pMap(
      items,
      async (item) => {
        if (item === 2) throw new Error("fail");
        return item;
      },
      { concurrency: 2, settle: true },
    );

    expect(results).toEqual([1, null, 3]);
  });

  it("propagates errors when settle is false", async () => {
    const items = [1, 2, 3];
    await expect(
      pMap(
        items,
        async (item) => {
          if (item === 2) throw new Error("boom");
          return item;
        },
        { concurrency: 2 },
      ),
    ).rejects.toThrow("boom");
  });

  it("handles empty array", async () => {
    const results = await pMap([], async (x) => x, { concurrency: 3 });
    expect(results).toEqual([]);
  });
});
