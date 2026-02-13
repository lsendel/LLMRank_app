"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Bell,
  Shield,
  Zap,
  AlertTriangle,
  Check,
} from "lucide-react";

// Placeholder data
const currentPlan = {
  tier: "starter" as const,
  name: "Starter",
  crawlsPerMonth: 10,
  crawlsUsed: 4,
  pagesPerCrawl: 100,
  projects: 5,
  projectsUsed: 3,
};

const plans = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    features: [
      "1 project",
      "10 pages per crawl",
      "2 crawls per month",
      "30-day history",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    price: "$29/mo",
    features: [
      "5 projects",
      "100 pages per crawl",
      "10 crawls per month",
      "90-day history",
      "Lighthouse analysis",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$99/mo",
    features: [
      "20 projects",
      "500 pages per crawl",
      "30 crawls per month",
      "1-year history",
      "API access",
    ],
  },
  {
    tier: "agency",
    name: "Agency",
    price: "$249/mo",
    features: [
      "50 projects",
      "2000 pages per crawl",
      "Unlimited crawls",
      "2-year history",
      "API access",
      "Custom LLM prompts",
    ],
  },
];

export default function SettingsPage() {
  const [emailNotifications, setEmailNotifications] = useState({
    crawlComplete: true,
    weeklyReport: true,
    scoreDrops: true,
    newIssues: false,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = (key: keyof typeof emailNotifications) => {
    setEmailNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    // TODO: Call API to delete account
    setTimeout(() => {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }, 2000);
  };

  const creditsRemaining = currentPlan.crawlsPerMonth - currentPlan.crawlsUsed;
  const creditsPercentUsed =
    (currentPlan.crawlsUsed / currentPlan.crawlsPerMonth) * 100;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Current Plan</CardTitle>
          </div>
          <CardDescription>
            You are on the{" "}
            <span className="font-semibold text-foreground">
              {currentPlan.name}
            </span>{" "}
            plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Crawl Credits</span>
              <span className="font-medium">
                {creditsRemaining} of {currentPlan.crawlsPerMonth} remaining
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${creditsPercentUsed}%` }}
              />
            </div>
          </div>

          {/* Usage stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Projects</p>
              <p className="text-lg font-semibold">
                {currentPlan.projectsUsed} / {currentPlan.projects}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Pages per Crawl</p>
              <p className="text-lg font-semibold">
                {currentPlan.pagesPerCrawl}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">
                Monthly Crawls Used
              </p>
              <p className="text-lg font-semibold">
                {currentPlan.crawlsUsed} / {currentPlan.crawlsPerMonth}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button>
            <Zap className="h-4 w-4" />
            Upgrade Plan
          </Button>
        </CardFooter>
      </Card>

      {/* Plan comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Plans</CardTitle>
          <CardDescription>
            Compare plans and choose the best fit for your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-lg border p-4 ${
                  plan.tier === currentPlan.tier
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.tier === currentPlan.tier && (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <p className="mb-3 text-2xl font-bold">{plan.price}</p>
                <ul className="space-y-1.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.tier !== currentPlan.tier && (
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                    {plans.indexOf(plan) >
                    plans.findIndex((p) => p.tier === currentPlan.tier)
                      ? "Upgrade"
                      : "Downgrade"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              Notification Preferences
            </CardTitle>
          </div>
          <CardDescription>
            Choose which email notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {[
            {
              key: "crawlComplete" as const,
              label: "Crawl Complete",
              description: "Get notified when a crawl finishes.",
            },
            {
              key: "weeklyReport" as const,
              label: "Weekly Report",
              description: "Receive a weekly summary of your project scores.",
            },
            {
              key: "scoreDrops" as const,
              label: "Score Drops",
              description:
                "Get alerted when a project score drops by 10+ points.",
            },
            {
              key: "newIssues" as const,
              label: "New Critical Issues",
              description:
                "Get notified when new critical issues are detected.",
            },
          ].map((notification, index) => (
            <div key={notification.key}>
              {index > 0 && <Separator className="my-0" />}
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium">{notification.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {notification.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotifications[notification.key]}
                  onClick={() => handleToggle(notification.key)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    emailNotifications[notification.key]
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      emailNotifications[notification.key]
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base text-destructive">
              Danger Zone
            </CardTitle>
          </div>
          <CardDescription>
            Irreversible actions that will permanently affect your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account, all projects, and crawl data.
              </p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Delete Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be undone. This will permanently delete
                    your account, all projects, crawl history, and associated
                    data.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">
                    All data will be permanently lost.
                  </p>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
