"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

export function useApi(): {
  withToken: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
  getToken: () => Promise<string | null>;
} {
  const { getToken } = useAuth();

  const withToken = useCallback(
    async <T>(fn: (token: string) => Promise<T>): Promise<T> => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return fn(token);
    },
    [getToken],
  );

  return { withToken, getToken };
}
