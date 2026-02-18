import posthog from "posthog-js";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

type GaParams = Record<string, string | number | boolean>;

const hasGa = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

let initialized = false;

export function initTelemetry(apiKey: string, apiHost?: string) {
  if (initialized || typeof window === "undefined") return;
  posthog.init(apiKey, {
    api_host: apiHost ?? "https://us.i.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    loaded: () => {
      initialized = true;
    },
  });
}

export function identify(
  userId: string,
  traits: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.identify(userId, traits);
  withGtag((gtag) => {
    gtag("set", { user_id: userId });
    const userProps = sanitizeForGa(traits);
    if (userProps && Object.keys(userProps).length > 0) {
      gtag("set", "user_properties", userProps);
    }
  });
}

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
  withGtag((gtag) => {
    const params = sanitizeForGa(properties);
    gtag("event", event, params);
  });
}

export function page(name: string): void {
  if (typeof window === "undefined") return;
  posthog.capture("$pageview", { page_name: name });
  withGtag((gtag) => {
    gtag("event", "page_view", {
      page_title: name,
      page_location: window.location.href,
    });
  });
}

export function reset(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
  withGtag((gtag) => {
    gtag("set", { user_id: undefined });
  });
}

export function getFeatureFlag(key: string): boolean | string | undefined {
  if (typeof window === "undefined") return undefined;
  return posthog.getFeatureFlag(key);
}

function withGtag(callback: (fn: (...args: unknown[]) => void) => void): void {
  if (!hasGa || typeof window === "undefined") return;
  const gtag = window.gtag;
  if (typeof gtag !== "function") return;
  callback(gtag);
}

function sanitizeForGa(
  properties?: Record<string, unknown>,
): GaParams | undefined {
  if (!properties) return undefined;
  const params: GaParams = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value == null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      params[key] = value;
    } else {
      params[key] = JSON.stringify(value);
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}
