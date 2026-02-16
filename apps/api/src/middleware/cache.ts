import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../index";

interface CacheOptions {
  public?: boolean;
  maxAge?: number;
  staleWhileRevalidate?: number;
}

export const cacheMiddleware = (options: CacheOptions = {}) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const {
      public: isPublic = true,
      maxAge = 60, // 1 minute default
      staleWhileRevalidate = 300, // 5 minutes default
    } = options;

    const directives = [
      isPublic ? "public" : "private",
      `max-age=${maxAge}`,
      staleWhileRevalidate
        ? `stale-while-revalidate=${staleWhileRevalidate}`
        : "",
    ].filter(Boolean);

    await next();

    // Only apply cache headers to successful GET requests
    if (c.req.method === "GET" && c.res.status === 200) {
      c.header("Cache-Control", directives.join(", "));
    }
  });
