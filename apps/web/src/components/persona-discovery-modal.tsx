"use client";

import { useState } from "react";
import { Users, Globe, Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { track } from "@/lib/telemetry";

const STORAGE_KEY = "persona-modal-dismissed";
const MAX_DISMISSALS = 3;
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDismissState(): { count: number; lastAt: number } {
  if (typeof window === "undefined")
    return { count: MAX_DISMISSALS, lastAt: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, lastAt: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, lastAt: 0 };
  }
}

export function shouldShowPersonaModal(): boolean {
  const { count, lastAt } = getDismissState();
  if (count >= MAX_DISMISSALS) return false;
  if (lastAt && Date.now() - lastAt < COOLDOWN_MS) return false;
  return true;
}

interface PersonaDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  defaultDomain?: string;
}

export function PersonaDiscoveryModal({
  open,
  onClose,
  defaultDomain,
}: PersonaDiscoveryModalProps) {
  const [workStyle, setWorkStyle] = useState<string | null>(null);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDismiss = () => {
    const state = getDismissState();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ count: state.count + 1, lastAt: Date.now() }),
    );
    track("persona_modal_dismissed");
    onClose();
  };

  const handleSave = async () => {
    if (!workStyle) return;
    setSaving(true);
    try {
      const result = await api.account.classifyPersona({
        teamSize: teamSize ?? "solo",
        primaryGoal: workStyle,
        domain: defaultDomain,
      });
      track("persona_classified", {
        persona: result.persona,
        source: "modal",
        confidence: result.confidence,
      });
      // Mark as permanently done
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ count: MAX_DISMISSALS, lastAt: Date.now() }),
      );
      onClose();
    } catch {
      // On error, just close — best-effort
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize your dashboard</DialogTitle>
          <DialogDescription>
            Tell us how you work so we can show you the most relevant data
            first. Takes 10 seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Q1 */}
          <div className="space-y-2">
            <Label>How do you work?</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    value: "client_reporting",
                    label: "Manage client sites",
                    Icon: Users,
                  },
                  {
                    value: "own_site_optimization",
                    label: "Optimize my site",
                    Icon: Globe,
                  },
                  {
                    value: "technical_audit",
                    label: "Technical audits",
                    Icon: Code,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setWorkStyle(option.value);
                    if (option.value !== "client_reporting") {
                      setTeamSize(null);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors hover:border-primary/60",
                    workStyle === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <option.Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Q2 */}
          {workStyle === "client_reporting" && (
            <div className="space-y-2">
              <Label>Team size?</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: "solo", label: "Just me" },
                    { value: "small_team", label: "2-10" },
                    { value: "large_team", label: "10+" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTeamSize(option.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-primary/60",
                      teamSize === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleDismiss} disabled={saving}>
            Skip for now
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !workStyle ||
              (workStyle === "client_reporting" && !teamSize)
            }
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
