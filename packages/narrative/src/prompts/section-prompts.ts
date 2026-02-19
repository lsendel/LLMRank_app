export const SECTION_PROMPTS: Record<string, string> = {
  executive_summary: `Write a 200-300 word executive summary of this website's AI readiness audit.
Include: the overall score and grade, the strongest and weakest category, the single most impactful finding, and a forward-looking statement about what improvement is possible.`,

  technical_analysis: `Write a 300-500 word analysis of the site's technical SEO health.
Cover: crawlability, indexability, schema markup, canonical setup, robots.txt/LLMs.txt, and any critical technical blockers. Reference the technical score and specific issues found.`,

  content_analysis: `Write a 300-500 word analysis of the site's content quality.
Cover: content depth (word count trends), clarity and readability scores, authority signals, structure quality, and citation worthiness. Reference the LLM content dimension scores.`,

  ai_readiness_analysis: `Write a 300-500 word analysis of the site's AI readiness.
Cover: discoverability by AI crawlers, content citeability, structured data for AI consumption, LLMs.txt presence, and AI crawler access. This is the most differentiating category for this platform.`,

  performance_analysis: `Write a 200-300 word analysis of the site's performance.
Cover: Core Web Vitals (LCP, FCP, CLS, TBT), Lighthouse scores, and how performance impacts both traditional SEO and AI crawler access.`,

  trend_analysis: `Write a 200-400 word trend analysis comparing the current crawl to the previous one.
Highlight: which scores improved or declined, the likely causes based on issue changes, and momentum indicators. Frame improvements positively and regressions as priorities.`,

  competitive_positioning: `Write a 200-400 word competitive positioning analysis.
Cover: how the site compares to tracked competitors in AI visibility, which competitors appear more frequently in LLM responses, and specific competitive gaps or advantages.`,

  priority_recommendations: `Write a 400-600 word prioritized action plan.
Structure as a numbered list of 5-8 recommendations ordered by ROI (score impact vs effort). Each recommendation should include: what to do, why it matters, expected score impact, and estimated effort level.`,
};
