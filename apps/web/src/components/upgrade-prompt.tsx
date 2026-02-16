"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UpgradePromptProps {
  feature: string;
  description: string;
  nextTier: string;
  nextTierUnlocks: string;
}

export function UpgradePrompt({
  feature,
  description,
  nextTier,
  nextTierUnlocks,
}: UpgradePromptProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{feature}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium text-primary">{nextTier}</span>{" "}
            unlocks: {nextTierUnlocks}
          </p>
          <Link href="/pricing" className="mt-3 inline-block">
            <Button size="sm" className="gap-1">
              View Plans
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
