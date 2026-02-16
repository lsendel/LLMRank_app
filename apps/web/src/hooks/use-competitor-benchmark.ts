"use client";

import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";
import { useCallback } from "react";

export function useCompetitorComparison(projectId: string) {
  const { data, isLoading, error, mutate } = useApiSWR(
    `competitor-comparison-${projectId}`,
    useCallback(() => api.benchmarks.list(projectId), [projectId]),
  );

  return {
    data,
    isLoading,
    error,
    mutate,
  };
}
