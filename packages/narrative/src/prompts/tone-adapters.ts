import type { NarrativeTone } from "@llm-boost/shared";

const TECHNICAL_ADAPTER = `Write for an SEO professional audience. Use technical SEO terminology directly:
- Reference specific factors (canonical tags, schema markup, robots.txt, LLMs.txt, Core Web Vitals)
- Include code-level recommendations where relevant (e.g., "add <link rel='canonical'> to...")
- Use precise metric names (LCP, FCP, CLS, TBT)
- Reference scoring categories by name (Technical SEO, Content Quality, AI Readiness, Performance)`;

const BUSINESS_ADAPTER = `Write for a business stakeholder audience (CMO, VP Marketing, CEO). Translate all technical findings into business impact:
- Frame scores as competitive positioning ("your site ranks in the top 20% for AI readiness")
- Translate technical issues into revenue risk or opportunity cost
- Use analogies to explain technical concepts
- Focus on ROI, competitive advantage, and brand visibility
- Avoid jargon — say "search visibility" not "crawl budget", "AI citations" not "LLM citeability"`;

export function getToneAdapter(tone: NarrativeTone): string {
  return tone === "technical" ? TECHNICAL_ADAPTER : BUSINESS_ADAPTER;
}
