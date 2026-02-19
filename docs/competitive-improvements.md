# Competitive Improvements — Research Notes

Competitive analysis against Promptwatch, Cairrot, OtterlyAI, Rank Prompt, and Promptmonitor.

## Feature Gap Matrix

| Feature                                          | Competitors              | Our Status                          | Priority | Notes                                                                             |
| ------------------------------------------------ | ------------------------ | ----------------------------------- | -------- | --------------------------------------------------------------------------------- |
| Perplexity Search API (raw results, $5/1k req)   | Cairrot, Promptwatch     | Using Sonar LLM ($0.50-2/1M tokens) | Medium   | Could reduce cost and get raw search results instead of LLM-generated answers     |
| DataForSEO LLM Mentions API (aggregate tracking) | OtterlyAI, DataForSEO    | Not integrated                      | High     | Bulk mentions tracking without per-query API calls; design plan in `docs/plans/`  |
| Geolocation-based response tracking              | Promptwatch, Rank Prompt | Missing                             | Medium   | Responses vary by locale; need geo-aware proxy or provider-specific locale params |
| Publisher contact extraction                     | Promptmonitor            | Missing                             | Low      | Extract contact info from citing publishers for outreach; niche feature           |
| Meta AI provider                                 | None tracked             | Missing (no public API)             | Low      | Wait for public API availability                                                  |
| Scheduled comparison reports (diff over time)    | OtterlyAI                | Partial (we have scheduled checks)  | Medium   | Need diff visualization showing rank changes across check periods                 |
| Multi-language query support                     | Promptwatch              | Missing                             | Medium   | Run same query in multiple languages to track intl visibility                     |

## Recommended Next Steps

1. **DataForSEO integration** — highest ROI. Enables bulk brand mention tracking across AI platforms without expensive per-query API calls. Design plan already exists.
2. **Perplexity Search API** — evaluate switching from Sonar LLM to raw Search API for cost savings and richer citation data.
3. **Geo-aware tracking** — start with US/UK/EU as preset regions using provider-specific locale parameters where available.
4. **Diff reports** — extend existing scheduled checks to compute and display rank position changes over time.
