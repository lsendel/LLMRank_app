const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

// ─── Error handling ─────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Types ──────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
  settings: {
    maxPages: number;
    maxDepth: number;
    schedule: "manual" | "daily" | "weekly" | "monthly";
  };
  last_crawl_id: string | null;
  last_score: number | null;
  last_letter_grade: string | null;
}

export interface CreateProjectInput {
  name: string;
  domain: string;
}

export interface UpdateProjectInput {
  name?: string;
  settings?: {
    maxPages?: number;
    maxDepth?: number;
    schedule?: "manual" | "daily" | "weekly" | "monthly";
  };
}

export interface CrawlJob {
  id: string;
  project_id: string;
  status: "pending" | "crawling" | "scoring" | "complete" | "failed";
  started_at: string | null;
  completed_at: string | null;
  pages_found: number;
  pages_crawled: number;
  pages_scored: number;
  pages_errored: number;
  overall_score: number | null;
  letter_grade: string | null;
  scores: {
    technical: number;
    content: number;
    ai_readiness: number;
    performance: number;
  } | null;
  error_message: string | null;
}

export interface CrawlProgress {
  status: "pending" | "crawling" | "scoring" | "complete" | "failed";
  pages_found: number;
  pages_crawled: number;
  pages_scored: number;
  started_at: string | null;
}

export interface CrawledPage {
  id: string;
  crawl_id: string;
  url: string;
  status_code: number;
  title: string | null;
  meta_description: string | null;
  word_count: number;
  overall_score: number | null;
  technical_score: number | null;
  content_score: number | null;
  ai_readiness_score: number | null;
  performance_score: number | null;
  letter_grade: string | null;
  issue_count: number;
}

export interface PageDetail extends CrawledPage {
  canonical_url: string | null;
  extracted: {
    h1: string[];
    h2: string[];
    schema_types: string[];
    internal_links: string[];
    external_links: string[];
    images_without_alt: number;
    has_robots_meta: boolean;
  };
  lighthouse: {
    performance: number;
    seo: number;
    accessibility: number;
    best_practices: number;
  } | null;
  issues: PageIssue[];
}

export interface PageIssue {
  code: string;
  category: "technical" | "content" | "ai_readiness" | "performance";
  severity: "critical" | "warning" | "info";
  message: string;
  recommendation: string;
  data?: Record<string, unknown>;
}

export interface ProjectScore {
  crawl_id: string;
  overall_score: number;
  technical_score: number;
  content_score: number;
  ai_readiness_score: number;
  performance_score: number;
  letter_grade: string;
  scored_at: string;
}

export interface BillingInfo {
  plan: "free" | "starter" | "pro" | "agency";
  crawls_used: number;
  crawls_limit: number;
  projects_used: number;
  projects_limit: number;
  current_period_end: string;
  stripe_customer_id: string | null;
}

export interface DashboardStats {
  total_projects: number;
  total_crawls: number;
  avg_score: number;
  credits_remaining: number;
  credits_total: number;
}

// ─── Request helpers ────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, token, headers: extraHeaders, ...init } = options;

  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      errorBody?.error?.code ?? "UNKNOWN_ERROR",
      errorBody?.error?.message ?? response.statusText,
      errorBody?.error?.details,
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ─── Base client ────────────────────────────────────────────────────

export const apiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "GET" });
  },

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "POST", body });
  },

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PUT", body });
  },

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "PATCH", body });
  },

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return request<T>(path, { ...options, method: "DELETE" });
  },
};

// ─── Domain-specific API methods ────────────────────────────────────

export const api = {
  // ── Dashboard ───────────────────────────────────────────────────
  dashboard: {
    getStats(token: string): Promise<DashboardStats> {
      return apiClient.get("/dashboard/stats", { token });
    },
    getRecentActivity(token: string): Promise<CrawlJob[]> {
      return apiClient.get("/dashboard/activity", { token });
    },
  },

  // ── Projects ────────────────────────────────────────────────────
  projects: {
    list(
      token: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<Project>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const qs = searchParams.toString();
      return apiClient.get(`/projects${qs ? `?${qs}` : ""}`, { token });
    },

    get(token: string, projectId: string): Promise<Project> {
      return apiClient.get(`/projects/${projectId}`, { token });
    },

    create(token: string, data: CreateProjectInput): Promise<Project> {
      return apiClient.post("/projects", data, { token });
    },

    update(
      token: string,
      projectId: string,
      data: UpdateProjectInput,
    ): Promise<Project> {
      return apiClient.patch(`/projects/${projectId}`, data, { token });
    },

    delete(token: string, projectId: string): Promise<void> {
      return apiClient.delete(`/projects/${projectId}`, { token });
    },
  },

  // ── Crawls ──────────────────────────────────────────────────────
  crawls: {
    start(token: string, projectId: string): Promise<CrawlJob> {
      return apiClient.post(`/projects/${projectId}/crawls`, undefined, {
        token,
      });
    },

    list(
      token: string,
      projectId: string,
      params?: { page?: number; limit?: number },
    ): Promise<PaginatedResponse<CrawlJob>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const qs = searchParams.toString();
      return apiClient.get(
        `/projects/${projectId}/crawls${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    get(token: string, crawlId: string): Promise<CrawlJob> {
      return apiClient.get(`/crawls/${crawlId}`, { token });
    },

    getProgress(token: string, crawlId: string): Promise<CrawlProgress> {
      return apiClient.get(`/crawls/${crawlId}/progress`, { token });
    },

    cancel(token: string, crawlId: string): Promise<void> {
      return apiClient.post(`/crawls/${crawlId}/cancel`, undefined, { token });
    },
  },

  // ── Pages ───────────────────────────────────────────────────────
  pages: {
    list(
      token: string,
      crawlId: string,
      params?: { page?: number; limit?: number; sort?: string; order?: string },
    ): Promise<PaginatedResponse<CrawledPage>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.sort) searchParams.set("sort", params.sort);
      if (params?.order) searchParams.set("order", params.order);
      const qs = searchParams.toString();
      return apiClient.get(`/crawls/${crawlId}/pages${qs ? `?${qs}` : ""}`, {
        token,
      });
    },

    get(token: string, pageId: string): Promise<PageDetail> {
      return apiClient.get(`/pages/${pageId}`, { token });
    },
  },

  // ── Scores ──────────────────────────────────────────────────────
  scores: {
    getProjectHistory(
      token: string,
      projectId: string,
      params?: { limit?: number },
    ): Promise<ProjectScore[]> {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.set("limit", String(params.limit));
      const qs = searchParams.toString();
      return apiClient.get(
        `/projects/${projectId}/scores${qs ? `?${qs}` : ""}`,
        { token },
      );
    },
  },

  // ── Issues ──────────────────────────────────────────────────────
  issues: {
    listForProject(
      token: string,
      projectId: string,
      params?: {
        page?: number;
        limit?: number;
        severity?: string;
        category?: string;
      },
    ): Promise<PaginatedResponse<PageIssue>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.severity) searchParams.set("severity", params.severity);
      if (params?.category) searchParams.set("category", params.category);
      const qs = searchParams.toString();
      return apiClient.get(
        `/projects/${projectId}/issues${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    listForCrawl(
      token: string,
      crawlId: string,
      params?: {
        page?: number;
        limit?: number;
        severity?: string;
        category?: string;
      },
    ): Promise<PaginatedResponse<PageIssue>> {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set("page", String(params.page));
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.severity) searchParams.set("severity", params.severity);
      if (params?.category) searchParams.set("category", params.category);
      const qs = searchParams.toString();
      return apiClient.get(`/crawls/${crawlId}/issues${qs ? `?${qs}` : ""}`, {
        token,
      });
    },
  },

  // ── Billing ─────────────────────────────────────────────────────
  billing: {
    getInfo(token: string): Promise<BillingInfo> {
      return apiClient.get("/billing", { token });
    },

    createCheckoutSession(
      token: string,
      plan: string,
    ): Promise<{ checkout_url: string }> {
      return apiClient.post("/billing/checkout", { plan }, { token });
    },

    createPortalSession(token: string): Promise<{ portal_url: string }> {
      return apiClient.post("/billing/portal", undefined, { token });
    },
  },

  // ── Account ─────────────────────────────────────────────────────
  account: {
    deleteAccount(token: string): Promise<void> {
      return apiClient.delete("/account", { token });
    },

    updateNotificationPreferences(
      token: string,
      prefs: {
        crawl_complete?: boolean;
        weekly_report?: boolean;
        score_drops?: boolean;
        new_issues?: boolean;
      },
    ): Promise<void> {
      return apiClient.patch("/account/notifications", prefs, { token });
    },
  },
};
