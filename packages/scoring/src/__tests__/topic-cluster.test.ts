import { describe, test, expect } from "vitest";
import {
  clusterPagesByTopic,
  type PageTopicInput,
} from "../domain/topic-cluster";

const pages: PageTopicInput[] = [
  {
    url: "/pricing",
    title: "Pricing Plans",
    headings: ["Pricing", "Free Plan", "Pro Plan"],
  },
  {
    url: "/plans",
    title: "Our Plans",
    headings: ["Plans", "Starter", "Enterprise"],
  },
  {
    url: "/blog/seo-tips",
    title: "10 SEO Tips",
    headings: ["SEO Tips", "Keyword Research", "Link Building"],
  },
  {
    url: "/blog/seo-guide",
    title: "SEO Guide",
    headings: ["Complete SEO Guide", "On-Page SEO", "Technical SEO"],
  },
  { url: "/about", title: "About Us", headings: ["Our Team", "Our Mission"] },
  {
    url: "/contact",
    title: "Contact Us",
    headings: ["Get in Touch", "Office Location"],
  },
];

describe("Topic clustering", () => {
  test("groups semantically related pages", () => {
    const clusters = clusterPagesByTopic(pages);
    expect(clusters.length).toBeGreaterThan(1);
    expect(clusters.length).toBeLessThanOrEqual(pages.length);
  });

  test("each cluster has a label and pages", () => {
    const clusters = clusterPagesByTopic(pages);
    for (const cluster of clusters) {
      expect(cluster.label).toBeTruthy();
      expect(cluster.pages.length).toBeGreaterThan(0);
    }
  });

  test("all input pages appear in exactly one cluster", () => {
    const clusters = clusterPagesByTopic(pages);
    const allUrls = clusters.flatMap((c) => c.pages.map((p) => p.url));
    expect(allUrls.sort()).toEqual(pages.map((p) => p.url).sort());
  });

  test("returns single cluster for single page", () => {
    const clusters = clusterPagesByTopic([pages[0]]);
    expect(clusters.length).toBe(1);
  });

  test("returns empty for empty input", () => {
    const clusters = clusterPagesByTopic([]);
    expect(clusters.length).toBe(0);
  });
});
