"use client";

import { useCallback } from "react";
import { useApiSWR } from "@/lib/use-api-swr";
import { useApi } from "@/lib/use-api";
import { api } from "@/lib/api";

export function useProject(id: string | undefined) {
  return useApiSWR(
    id ? `project-${id}` : null,
    useCallback(() => api.projects.get(id!), [id]),
  );
}

export function useProjects() {
  return useApiSWR(
    "projects",
    useCallback(() => api.projects.list(), []),
  );
}

export function useCreateProject() {
  const { withAuth } = useApi();

  async function createProject(data: { name: string; domain: string }) {
    return withAuth(() => api.projects.create(data));
  }

  return { createProject };
}
