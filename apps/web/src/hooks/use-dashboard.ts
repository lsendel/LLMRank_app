"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api } from "@/lib/api";

export function useDashboardStats() {
  return useApiSWR(
    "dashboard-stats",
    useCallback(() => api.dashboard.getStats(), []),
  );
}

export function useRecentActivity() {
  return useApiSWR(
    "dashboard-activity",
    useCallback(() => api.dashboard.getRecentActivity(), []),
  );
}
