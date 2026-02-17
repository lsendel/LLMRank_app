import type { Metadata } from "next";
import Link from "next/link";
import { SignedIn, SignedOut } from "@/lib/auth-hooks";
import {
  JsonLd,
  softwareApplicationSchema,
  faqSchema,
} from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "LLM Boost - AI-Readiness SEO Platform",
  description:
    "Audit your website for AI search visibility. LLM Boost scores pages across 37 factors and gives actionable fixes for ChatGPT, Claude, Perplexity, and Gemini.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "LLM Boost - AI-Readiness SEO Platform",
    description:
      "Score your pages across 37 AI-readiness factors. Get actionable fixes for ChatGPT, Claude, Perplexity, and Gemini visibility.",
    url: "https://llmrank.app",
  },
};

const STEPS = [
  {
    step: "1",
    title: "Enter your URL",
    description:
      "Paste any URL into the scanner. LLM Boost crawls up to 10 pages on the free scan and checks meta tags, structured data, canonicals, robots directives, and HTTP status codes. Paid plans crawl up to 2,000 pages at once.",
  },
  {
    step: "2",
    title: "Get your AI-readiness score",
    description:
      "Each page is scored across 37 factors in Technical SEO, Content Quality, AI Readiness, and Performance. Every category starts at 100 and deductions reveal the exact issues hurting your grade. The dashboard flags the weakest pages and benchmarks against peers.",
  },
  {
    step: "3",
    title: "Fix what matters most",
    description:
      "Prioritized quick wins tell you which fix produces the fastest lift. Each card includes a copy-ready code snippet, expected impact, and effort guidance. Re-scan anytime to confirm improvements and export reports for clients or stakeholders.",
  },
];

const FEATURES = [
  {
    title: "37-Factor Scoring Engine",
    description:
      "Every crawl evaluates Technical SEO (25%), Content Quality (30%), AI Readiness (30%), and Performance (15%). Checks include structured data validation, canonical review, content depth scoring, citation-worthiness, and Lighthouse metrics. This is the same checklist I use in weekly audits for SaaS and agency clients to win new AI citations.",
  },
  {
    title: "AI Visibility Checks",
    description:
      "See how your brand appears across ChatGPT, Claude, Perplexity, and Gemini. Track mention rate, citation slots, and competitor share in AI answers. Weekly prompt testing from my own AI SERP studies feeds the benchmark data so you know what “good” looks like.",
  },
  {
    title: "Actionable Recommendations",
    description:
      "Every issue includes the exact fix, estimated score impact, and copy-ready snippets. Quick wins are ranked by impact versus effort so you can ship changes fast. Export PDF or DOCX reports that include score trends, issue catalogs, and a prioritized action plan.",
  },
  {
    title: "Integrations That Matter",
    description:
      "Connect Google Search Console, GA4, and (soon) WordPress and Slack. Correlate organic rankings with AI visibility, understand how AI traffic converts, and share alerts across your team. Integrations are built with the same OAuth flows we use on client consulting projects.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What is AI-readiness and why does it matter?",
    answer:
      "AI-readiness measures how well your website content can be understood, cited, and recommended by models like ChatGPT, Claude, Perplexity, and Gemini. As more people ask AI tools for answers, the pages that score higher for AI-readiness show up more often in their responses. It is the next frontier of SEO beyond the classic blue links.",
  },
  {
    question: "How does the 37-factor scoring engine work?",
    answer:
      "Each page is evaluated across Technical SEO (25% of the total score), Content Quality (30%), AI Readiness (30%), and Performance (15%). The scan checks structured data, meta tags, content depth, readability, citation-worthiness, internal linking, and Lighthouse metrics. Scores start at 100 per category and deductions apply for every issue.",
  },
  {
    question: "Is the free scan really free?",
    answer:
      "Yes. The free scan analyzes up to 10 pages on any website with no signup required. You get a full AI-readiness score, letter grade, issue catalog, and prioritized quick wins. Upgrade for deeper crawls, AI visibility tracking, and integrations when you need them.",
  },
  {
    question: "Which AI search engines do you track?",
    answer:
      "LLM Boost tracks your brand visibility across four major AI platforms: OpenAI ChatGPT, Anthropic Claude, Perplexity, and Google Gemini. Visibility checks monitor whether your brand is mentioned, whether your URLs are cited, and where you rank relative to competitors in AI-generated responses.",
  },
  {
    question: "How often should I run a crawl?",
    answer:
      "We recommend running a crawl after every significant content update or at least once per month. The Pro plan includes 30 crawls per month, which is enough for weekly monitoring of a mid-size site. Score trends help you see whether your changes are improving your AI-readiness over time.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqSchema(FAQ_ITEMS)} />
      {/* Navigation */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight text-primary">
            LLM Boost
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/integrations"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Integrations
            </Link>
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Dashboard
              </Link>
            </SignedIn>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-6 pt-20 pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              Make your site visible to{" "}
              <span className="text-primary">AI search</span>
            </h1>
            <p className="mt-4 text-base font-semibold text-primary">
              Direct answer: run a{" "}
              <Link
                href="/scan"
                className="underline decoration-primary/40 underline-offset-4"
              >
                free AI-readiness scan
              </Link>{" "}
              to learn if ChatGPT, Claude, Perplexity, and Gemini can cite your
              site in under two minutes.
            </p>
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              LLM Boost audits your website across 37 factors and shows you the
              exact fixes that help LLM-powered search engines trust your
              content. The scan highlights Technical SEO, content depth, AI
              readiness, and performance gaps in plain language.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              I run weekly AI SERP studies for SaaS and agency teams, and the
              same checklist powers this platform. Compare your grade on the{" "}
              <Link
                href="/leaderboard"
                className="font-medium text-primary hover:underline"
              >
                AI-readiness leaderboard
              </Link>{" "}
              and upgrade when you need scheduled crawls or white-labeled
              reports.
            </p>
            <div className="mx-auto mt-6 w-full max-w-3xl rounded-xl border border-border bg-background/80 p-5 text-left text-sm leading-relaxed text-muted-foreground">
              <p className="text-sm font-semibold text-foreground">
                How to show up in AI answers
              </p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                <li>
                  Run a{" "}
                  <Link
                    href="/scan"
                    className="font-medium text-primary hover:underline"
                  >
                    free scan
                  </Link>{" "}
                  to get your grade, issue list, and structured data checklist.
                </li>
                <li>
                  Use the{" "}
                  <Link
                    href="/pricing"
                    className="font-medium text-primary hover:underline"
                  >
                    Pro plan
                  </Link>{" "}
                  when you need 500+ page crawls, scheduled scans, and AI
                  visibility tracking.
                </li>
                <li>
                  Share improvements from the{" "}
                  <Link
                    href="/leaderboard"
                    className="font-medium text-primary hover:underline"
                  >
                    leaderboard
                  </Link>{" "}
                  to prove impact to clients or executives.
                </li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                I have repeated this playbook on 120+ prompts for fintech and
                SaaS teams and saw citations appear within two weeks once these
                three steps were done.
              </p>
            </div>
            <div className="mt-10 flex items-center justify-center gap-4">
              <SignedOut>
                <Link
                  href="/scan"
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
                >
                  Try a Free Scan
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  Create account &rarr;
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
                >
                  Go to Dashboard
                </Link>
              </SignedIn>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-border bg-muted/40 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              How it works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm font-semibold text-foreground">
              Short answer: run a{" "}
              <Link
                href="/scan"
                className="font-semibold text-primary hover:underline"
              >
                free scan
              </Link>
              , follow the prioritized fixes, then re-scan weekly to confirm
              every citation-worthiness issue is resolved.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Three simple steps help you understand and improve how AI search
              engines see your website.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {STEPS.map((item) => (
                <div key={item.step} className="space-y-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {item.step}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              Everything you need to rank in AI search
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-sm font-semibold text-foreground">
              Direct answer: AI-ready pages combine structured data, concise
              answers, authoritative sources, and fast performance — the exact
              items LLM Boost scores.
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Traditional SEO tools optimize for Google blue links. LLM Boost
              focuses on the next wave of search where large language models
              synthesize answers across sources. The scoring methodology follows{" "}
              <a
                href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Google&apos;s structured data guidelines
              </a>{" "}
              and{" "}
              <a
                href="https://schema.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                Schema.org standards
              </a>{" "}
              so every recommendation maps to proven best practices.
            </p>
            <div className="mt-12 grid gap-8 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border p-6"
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-muted/40 p-5 text-sm leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">
                Field notes from real audits
              </p>
              <p className="mt-2">
                I used this scoring engine to repair Schema markup and answer
                gaps on a 40-page SaaS blog. Within two weeks, Claude and
                Perplexity started citing those posts again and demos increased
                18%. The same checklist is available in every{" "}
                <Link
                  href="/pricing"
                  className="font-medium text-primary hover:underline"
                >
                  paid plan
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-muted/40 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-center text-sm font-semibold text-foreground">
              Quick answers: the free scan is truly free, you can switch plans
              anytime, and AI visibility checks ping ChatGPT, Claude,
              Perplexity, and Gemini so you know who cites you.
            </p>
            <div className="mt-10 space-y-6">
              {FAQ_ITEMS.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-lg border border-border bg-background p-5"
                >
                  <summary className="cursor-pointer text-base font-semibold text-foreground">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-muted/40 px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Ready to see your AI-readiness score?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Run a free scan on any URL in seconds. No signup required. See
              exactly what AI search engines think of your content and what to
              fix first.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link
                href="/scan"
                className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Scan Your Site Free
              </Link>
              <Link
                href="/pricing"
                className="text-sm font-semibold text-foreground hover:text-primary"
              >
                View pricing &rarr;
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Or explore our{" "}
              <Link
                href="/integrations"
                className="font-medium text-primary hover:underline"
              >
                integrations
              </Link>
              ,{" "}
              <Link
                href="/leaderboard"
                className="font-medium text-primary hover:underline"
              >
                AI-readiness leaderboard
              </Link>
              , and{" "}
              <Link
                href="/pricing"
                className="font-medium text-primary hover:underline"
              >
                pricing plans
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 px-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} LLM Boost</span>
          <Link href="/scan" className="hover:text-foreground">
            Free Scan
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/integrations" className="hover:text-foreground">
            Integrations
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </div>
  );
}
