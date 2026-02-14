/**
 * Topic Clustering Domain Service — pure function, no side effects.
 *
 * Groups pages by semantic similarity using n-gram overlap on titles
 * and headings. Ported from RustySEO's ngrams.rs approach.
 */

export interface PageTopicInput {
  url: string;
  title: string | null;
  headings: string[];
}

export interface TopicCluster {
  label: string;
  pages: PageTopicInput[];
  keywords: string[];
}

/**
 * Cluster pages by topic using bigram overlap similarity.
 * Returns groups of semantically related pages.
 */
export function clusterPagesByTopic(pages: PageTopicInput[]): TopicCluster[] {
  if (pages.length === 0) return [];
  if (pages.length === 1) {
    return [
      {
        label: extractLabel(pages[0]),
        pages: [pages[0]],
        keywords: extractKeywords(pages[0]),
      },
    ];
  }

  // Step 1: Extract bigrams for each page
  const pageBigrams = pages.map((page) => ({
    page,
    bigrams: new Set(generateBigrams(pageToText(page))),
  }));

  // Step 2: Build adjacency via Jaccard similarity > threshold
  const THRESHOLD = 0.15;
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < pageBigrams.length; i++) {
    adjacency.set(i, new Set());
  }

  for (let i = 0; i < pageBigrams.length; i++) {
    for (let j = i + 1; j < pageBigrams.length; j++) {
      const similarity = jaccardSimilarity(
        pageBigrams[i].bigrams,
        pageBigrams[j].bigrams,
      );
      if (similarity >= THRESHOLD) {
        adjacency.get(i)!.add(j);
        adjacency.get(j)!.add(i);
      }
    }
  }

  // Step 3: Connected components = clusters
  const visited = new Set<number>();
  const clusters: TopicCluster[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (visited.has(i)) continue;

    const component: number[] = [];
    const stack = [i];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      component.push(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) stack.push(neighbor);
      }
    }

    const clusterPages = component.map((idx) => pages[idx]);
    const allKeywords = clusterPages.flatMap(extractKeywords);
    const topKeywords = mostFrequent(allKeywords, 5);

    clusters.push({
      label: topKeywords[0] ?? extractLabel(clusterPages[0]),
      pages: clusterPages,
      keywords: topKeywords,
    });
  }

  return clusters;
}

// ─── Private Helpers ────────────────────────────────────────────────

function pageToText(page: PageTopicInput): string {
  return [page.title ?? "", ...page.headings].join(" ").toLowerCase();
}

function generateBigrams(text: string): string[] {
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  // Also include unigrams for better matching
  bigrams.push(...words);
  return bigrams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function extractKeywords(page: PageTopicInput): string[] {
  const text = pageToText(page);
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function extractLabel(page: PageTopicInput): string {
  return (page.title ?? page.headings[0] ?? page.url).slice(0, 50);
}

function mostFrequent(words: string[], n: number): string[] {
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "our",
  "your",
  "their",
  "we",
  "you",
  "they",
  "he",
  "she",
  "not",
  "no",
  "so",
  "if",
  "then",
  "than",
  "more",
  "most",
  "very",
  "just",
  "about",
  "also",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "all",
  "each",
  "every",
]);
