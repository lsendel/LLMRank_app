import { analyzeResponse, type VisibilityCheckResult } from "../visibility";
import { withRetry, withTimeout } from "../retry";

const REQUEST_TIMEOUT_MS = 15_000;
const BING_SEARCH_URL = "https://api.bing.microsoft.com/v7.0/search";

/**
 * Check Copilot visibility using Bing Web Search API.
 * Microsoft Copilot grounds its responses on Bing search results,
 * so Bing ranking is a strong proxy for Copilot visibility.
 */
export async function checkCopilot(
  query: string,
  targetDomain: string,
  competitors: string[],
  apiKey: string,
): Promise<VisibilityCheckResult> {
  const url = `${BING_SEARCH_URL}?q=${encodeURIComponent(query)}&count=10`;

  const response = await withRetry(() =>
    withTimeout(
      fetch(url, {
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
      }),
      REQUEST_TIMEOUT_MS,
    ),
  );

  if (!response.ok) {
    throw new Error(`Bing API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    webPages?: {
      value: Array<{ name: string; url: string; snippet: string }>;
    };
  };

  const pages = data.webPages?.value ?? [];
  const responseText = pages
    .map((p) => `${p.name}\n${p.url}\n${p.snippet}`)
    .join("\n\n");

  const analysis = analyzeResponse(responseText, targetDomain, competitors);

  return {
    provider: "copilot",
    query,
    responseText,
    ...analysis,
  };
}
