"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type BillingInfo } from "@/lib/api";
import { GeneralSection } from "@/components/settings/general-section";
import { BillingSection } from "@/components/settings/billing-section";
import { BrandingSection } from "@/components/settings/branding-section";
import { NotificationChannelsSection } from "@/components/settings/notification-channels-section";
import { ApiTokensSection } from "@/components/settings/api-tokens-section";

export default function SettingsPage() {
  const searchParams = useSearchParams();

  const { isLoading: loading } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );

  const [successBanner, setSuccessBanner] = useState<string | null>(() => {
    if (searchParams.get("upgraded") === "true") {
      // Clean URL without triggering navigation
      window.history.replaceState({}, "", "/dashboard/settings");
      return "Your plan has been upgraded successfully! Your new features are now active.";
    }
    return null;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Success banner after upgrade */}
      {successBanner && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-medium">{successBanner}</p>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="text-green-600 hover:text-green-800 dark:text-green-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, plan, and notification preferences.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api-tokens">API Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-8">
          <GeneralSection />
        </TabsContent>

        <TabsContent value="billing" className="space-y-8">
          <BillingSection />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingSection />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationChannelsSection />
        </TabsContent>

        <TabsContent value="api-tokens" className="space-y-6">
          <ApiTokensSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
