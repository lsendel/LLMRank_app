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
      "Paste any website URL into the scanner. LLM Boost crawls your pages, checks technical SEO factors like meta tags and structured data, runs Lighthouse performance audits, and extracts content signals. The free scan covers up to 10 pages. Paid plans handle up to 2,000 pages per crawl.",
  },
  {
    step: "2",
    title: "Get your AI-readiness score",
    description:
      "Each page is scored across 37 factors in four categories: Technical SEO (25% weight), Content Quality (30%), AI Readiness (30%), and Performance (15%). You get a letter grade from A to F. The dashboard shows which pages need the most work and how your scores compare to industry benchmarks.",
  },
  {
    step: "3",
    title: "Fix what matters most",
    description:
      "Prioritized quick wins show you exactly what to fix first. Each recommendation is sorted by impact and effort. Common fixes include adding structured data, improving meta tags, expanding thin content, and adding authoritative citations. Track your progress as scores improve with each crawl.",
  },
];

const FEATURES = [
  {
    title: "37-Factor Scoring Engine",
    description:
      "Every page is evaluated across Technical SEO (25%), Content Quality (30%), AI Readiness (30%), and Performance (15%). Factors include structured data validation, canonical tag checks, content depth analysis, citation-worthiness scoring, and Lighthouse metrics. The engine follows Google's Search Central guidelines and Schema.org standards to ensure recommendations align with search engine best practices.",
  },
  {
    title: "AI Visibility Checks",
    description:
      "See how your brand appears across ChatGPT, Claude, Perplexity, and Gemini. Track mention rates, citation positions, and competitor presence in AI-generated responses. Understand which queries trigger mentions of your brand and where competitors appear instead. Visibility data updates with each crawl so you can measure the impact of your changes over time.",
  },
  {
    title: "Actionable Recommendations",
    description:
      "Every issue comes with a specific fix and an estimated score impact. Quick wins are ranked by impact-to-effort ratio so you know where to start. Export detailed PDF or DOCX reports for clients, stakeholders, or your content team. Reports include score trends, issue catalogs, and a prioritized action plan organized by urgency.",
  },
  {
    title: "Integrations That Matter",
    description:
      "Connect Google Search Console to correlate traditional search performance with AI readiness scores. Link Google Analytics 4 to track how AI-driven traffic converts on your site. A WordPress plugin is coming soon for real-time content scoring directly in the editor. Slack integration delivers score alerts and weekly summaries to your team.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What is AI-readiness and why does it matter?",
    answer:
      "AI-readiness measures how well your website content can be understood, cited, and recommended by large language models like ChatGPT, Claude, Perplexity, and Gemini. As more users turn to AI-powered search for answers, websites that score higher for AI-readiness are more likely to appear in AI-generated responses. This is the next frontier of SEO beyond traditional Google rankings.",
  },
  {
    question: "How does the 37-factor scoring engine work?",
    answer:
      "Each page is evaluated across four categories: Technical SEO (25% of the total score), Content Quality (30%), AI Readiness (30%), and Performance (15%). Factors include structured data presence, meta tag quality, content depth, readability, citation-worthiness, internal linking, and Lighthouse performance metrics. Scores start at 100 per category and deductions are applied for each issue found.",
  },
  {
    question: "Is the free scan really free?",
    answer:
      "Yes. The free scan analyzes up to 10 pages on any website with no signup required. You get a full AI-readiness score, letter grade, issue catalog, and prioritized quick wins. For deeper analysis covering up to 2,000 pages, recurring crawls, AI visibility tracking, and integrations, you can upgrade to a paid plan starting at $79 per month.",
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
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              LLM Boost audits your website for AI-readiness, scores every page
              across 37 factors, and gives you actionable recommendations to
              improve your visibility in ChatGPT, Perplexity, Claude, and other
              LLM-powered search engines.
            </p>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              LLM Boost is an AI-readiness SEO platform that crawls your website
              and scores every page across 37 factors in four categories:
              Technical SEO, Content Quality, AI Readiness, and Performance.
              Each page gets a letter grade from A to F, along with prioritized
              quick wins sorted by impact and effort. The platform checks your
              visibility in ChatGPT, Claude, Perplexity, and Gemini, tracks
              changes over time, and generates detailed PDF reports. Start with
              a free scan — no signup required.
            </p>
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
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Three steps to understand and improve how AI search engines see
              your website.
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
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Traditional SEO tools optimize for Google. LLM Boost optimizes for
              the next generation of search: large language models that
              synthesize answers from across the web. Our scoring methodology is
              built on{" "}
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
              </a>
              .
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
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-border bg-muted/40 px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              Frequently asked questions
            </h2>
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
