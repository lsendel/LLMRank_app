"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { isActiveCrawlStatus } from "@/components/crawl-progress";
import type { CrawlStatus } from "@/components/crawl-progress";

export function useCrawl(id: string | undefined) {
  return useApiSWR(
    id ? `crawl-${id}` : null,
    useCallback(() => api.crawls.get(id!), [id]),
  );
}

export function useCrawlHistory(projectId: string | undefined) {
  return useApiSWR(
    projectId ? `crawl-history-${projectId}` : null,
    useCallback(() => api.crawls.list(projectId!), [projectId]),
  );
}

/**
 * Polls a crawl until it reaches a terminal status.
 * Uses exponential backoff: 3s -> 4.5s -> 6.75s -> ... capped at 30s.
 */
export function useCrawlPolling(crawlId: string | null) {
  const [crawl, setCrawl] = useState<any>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(3000);

  useEffect(() => {
    if (!crawlId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const updated = await api.crawls.get(crawlId);
        if (cancelled) return;
        setCrawl(updated);

        if (isActiveCrawlStatus(updated.status as CrawlStatus)) {
          intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
          pollingRef.current = setTimeout(poll, intervalRef.current);
        }
      } catch {
        if (cancelled) return;
        intervalRef.current = Math.min(intervalRef.current * 1.5, 30000);
        pollingRef.current = setTimeout(poll, intervalRef.current);
      }
    };

    // Reset interval on new crawlId
    intervalRef.current = 3000;
    poll();

    return () => {
      cancelled = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [crawlId]);

  return { crawl };
}
