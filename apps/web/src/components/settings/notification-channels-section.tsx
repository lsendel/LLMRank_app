"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Plus, Trash2, Mail, Globe, Hash, Loader2 } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import {
  api,
  type BillingInfo,
  type NotificationChannel,
  type NotificationChannelType,
  type NotificationEventType,
} from "@/lib/api";

const channelLimits: Record<string, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  agency: 25,
};

const allEventTypes: { value: NotificationEventType; label: string }[] = [
  { value: "crawl_completed", label: "Crawl Completed" },
  { value: "score_drop", label: "Score Drop" },
  { value: "mention_gained", label: "Mention Gained" },
  { value: "mention_lost", label: "Mention Lost" },
  { value: "position_changed", label: "Position Changed" },
];

export function NotificationChannelsSection() {
  const { data: billing } = useApiSWR<BillingInfo>(
    "billing-info",
    useCallback(() => api.billing.getInfo(), []),
  );
  const { data: channels, mutate: mutateChannels } = useApiSWR<
    NotificationChannel[]
  >(
    "notification-channels",
    useCallback(() => api.channels.list(), []),
  );

  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [channelType, setChannelType] =
    useState<NotificationChannelType>("email");
  const [channelConfigValue, setChannelConfigValue] = useState("");
  const [channelEventTypes, setChannelEventTypes] = useState<
    NotificationEventType[]
  >(["crawl_completed"]);
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(
    null,
  );
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(
    null,
  );

  const maxChannels = channelLimits[billing?.plan ?? "free"] ?? 1;

  function toggleEventType(et: NotificationEventType) {
    setChannelEventTypes((prev) =>
      prev.includes(et) ? prev.filter((e) => e !== et) : [...prev, et],
    );
  }

  async function handleCreateChannel() {
    setChannelError(null);
    const val = channelConfigValue.trim();
    if (!val) {
      setChannelError("Please provide a value.");
      return;
    }
    if (channelType === "email" && !val.includes("@")) {
      setChannelError("Please enter a valid email address.");
      return;
    }
    if (
      (channelType === "webhook" || channelType === "slack_incoming") &&
      !val.startsWith("https://")
    ) {
      setChannelError("URL must start with https://");
      return;
    }
    if (channelEventTypes.length === 0) {
      setChannelError("Select at least one event type.");
      return;
    }
    setSavingChannel(true);
    try {
      const configKey = channelType === "email" ? "email" : "url";
      await api.channels.create({
        type: channelType,
        config: { [configKey]: val },
        eventTypes: channelEventTypes,
      });
      await mutateChannels();
      setAddChannelOpen(false);
      setChannelConfigValue("");
      setChannelType("email");
      setChannelEventTypes(["crawl_completed"]);
    } catch (err) {
      setChannelError(
        err instanceof Error ? err.message : "Failed to create channel",
      );
    } finally {
      setSavingChannel(false);
    }
  }

  async function handleToggleChannel(channel: NotificationChannel) {
    setTogglingChannelId(channel.id);
    try {
      await api.channels.update(channel.id, { enabled: !channel.enabled });
      await mutateChannels();
    } catch (err) {
      console.error("Failed to toggle channel:", err);
    } finally {
      setTogglingChannelId(null);
    }
  }

  async function handleDeleteChannel(id: string) {
    setDeletingChannelId(id);
    try {
      await api.channels.delete(id);
      await mutateChannels();
    } catch (err) {
      console.error("Failed to delete channel:", err);
    } finally {
      setDeletingChannelId(null);
    }
  }

  return (
    <div className="space-y-6 pt-4">
      {/* Channel usage */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notification Channels</h2>
          <p className="text-sm text-muted-foreground">
            Configure where you receive alerts about crawls, score changes, and
            visibility events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {channels?.length ?? 0} / {maxChannels} channels
          </Badge>
          <Dialog open={addChannelOpen} onOpenChange={setAddChannelOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                disabled={(channels?.length ?? 0) >= maxChannels}
              >
                <Plus className="h-4 w-4" />
                Add Channel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Notification Channel</DialogTitle>
                <DialogDescription>
                  Choose a channel type and configure where to send alerts.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Channel type */}
                <div className="space-y-2">
                  <Label>Channel Type</Label>
                  <Select
                    value={channelType}
                    onValueChange={(v) =>
                      setChannelType(v as NotificationChannelType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="slack_incoming">
                        Slack Incoming Webhook
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Config input */}
                <div className="space-y-2">
                  <Label>
                    {channelType === "email"
                      ? "Email Address"
                      : channelType === "slack_incoming"
                        ? "Slack Webhook URL"
                        : "Webhook URL"}
                  </Label>
                  <Input
                    placeholder={
                      channelType === "email"
                        ? "alerts@example.com"
                        : channelType === "slack_incoming"
                          ? "https://hooks.slack.com/services/..."
                          : "https://api.example.com/webhook"
                    }
                    value={channelConfigValue}
                    onChange={(e) => {
                      setChannelConfigValue(e.target.value);
                      setChannelError(null);
                    }}
                  />
                </div>

                {/* Event types */}
                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <div className="space-y-2">
                    {allEventTypes.map((et) => (
                      <label
                        key={et.value}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={channelEventTypes.includes(et.value)}
                          onChange={() => toggleEventType(et.value)}
                          className="rounded border-input"
                        />
                        {et.label}
                      </label>
                    ))}
                  </div>
                </div>

                {channelError && (
                  <p className="text-sm text-destructive">{channelError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddChannelOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateChannel} disabled={savingChannel}>
                  {savingChannel ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Channel"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Channel list */}
      {!channels || channels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No notification channels configured yet. Add one to start
              receiving alerts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const configDisplay =
              channel.type === "email"
                ? channel.config.email
                : channel.config.url;
            let typeLabel: string;
            if (channel.type === "email") {
              typeLabel = "Email";
            } else if (channel.type === "slack_incoming") {
              typeLabel = "Slack";
            } else {
              typeLabel = "Webhook";
            }
            let TypeIcon: typeof Mail;
            if (channel.type === "email") {
              TypeIcon = Mail;
            } else if (channel.type === "slack_incoming") {
              TypeIcon = Hash;
            } else {
              TypeIcon = Globe;
            }

            return (
              <Card key={channel.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {typeLabel}
                        </Badge>
                        {!channel.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {configDisplay}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {channel.eventTypes.map((et) => (
                          <Badge
                            key={et}
                            variant="secondary"
                            className="text-xs font-normal"
                          >
                            {et.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {/* Toggle */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={channel.enabled}
                      disabled={togglingChannelId === channel.id}
                      onClick={() => handleToggleChannel(channel)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        channel.enabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          channel.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingChannelId === channel.id}
                      onClick={() => handleDeleteChannel(channel.id)}
                    >
                      {deletingChannelId === channel.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
