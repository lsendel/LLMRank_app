interface PMapOptions {
  concurrency: number;
  settle?: boolean;
}

/**
 * Map over items with limited concurrency.
 * If settle=true, failed items return null instead of throwing.
 */
export async function pMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  opts: PMapOptions,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        if (!opts.settle) throw err;
        results[i] = null;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(opts.concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
