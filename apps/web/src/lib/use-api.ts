"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function useApi() {
  const router = useRouter();

  const withAuth = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error: any) {
        if (error?.status === 401) {
          router.push("/sign-in");
        }
        throw error;
      }
    },
    [router],
  );

  return { withAuth };
}
