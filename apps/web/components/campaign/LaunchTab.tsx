"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { launchCampaign, pauseCampaign, resumeCampaign } from "@/lib/api/campaigns";
import { senderList, sequenceIsReady } from "@/lib/campaign/helpers";
import type { Campaign, CampaignStep } from "@/lib/types/campaign";
import { SendingStatusCard } from "./PerformanceTab";

export function LaunchTab({
  campaign,
  steps,
  onUpdated,
  onSaveSequence,
  onOpenSettings,
}: {
  campaign: Campaign;
  steps: CampaignStep[];
  onUpdated: (campaign: Campaign) => void;
  onSaveSequence: () => Promise<void>;
  onOpenSettings: (section: "senders" | "schedule") => void;
}) {
  const [busy, setBusy] = useState(false);
  const senders = senderList(campaign);
  const readySequence = sequenceIsReady(steps);
  const leadCount = campaign.stats?.total || 0;
  const checks = [
    {
      ok: readySequence,
      label: "Every email has a subject and a message",
    },
    {
      ok: senders.length > 0,
      label: senders.length
        ? `${senders.length} mailbox${senders.length === 1 ? "" : "es"} selected`
        : "Select a connected Gmail mailbox",
    },
    {
      ok: leadCount > 0,
      label: leadCount
        ? `${leadCount} lead${leadCount === 1 ? "" : "s"} in this campaign`
        : "Import at least one lead",
    },
  ];
  const canLaunch = checks.every((check) => check.ok);

  async function run(action: "launch" | "pause" | "resume") {
    setBusy(true);
    try {
      if (action !== "pause") {
        await onSaveSequence();
      }
      const next =
        action === "launch"
          ? await launchCampaign(campaign._id)
          : action === "pause"
            ? await pauseCampaign(campaign._id)
            : await resumeCampaign(campaign._id);
      onUpdated(next);
      toast.success(
        action === "launch"
          ? next.sending?.reason || "Campaign launched"
          : action === "pause"
            ? "Campaign paused"
            : next.sending?.reason || "Campaign resumed",
      );
    } catch {
      // interceptor
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h2 className="font-heading text-2xl">Launch</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sends stay inside your timezone window, respect the gap between leads,
          and cap at {campaign.dailySendingLimit} emails per day. "No extra wait"
          still waits until {campaign.sendWindowStart}–{campaign.sendWindowEnd}{" "}
          in {campaign.timezone}. Follow-ups wait the delay on each step. Replies
          stop the remaining emails.
        </p>
      </div>

      <ul className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
        {checks.map((check) => (
          <li key={check.label} className="flex gap-2">
            <span className={check.ok ? "text-primary" : "text-destructive"}>
              {check.ok ? "●" : "○"}
            </span>
            {check.label}
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p>
          Window: {campaign.sendWindowStart}–{campaign.sendWindowEnd} ·{" "}
          {campaign.timezone}
        </p>
        <p className="mt-1 text-muted-foreground">
          Gap between new leads: {Math.round(campaign.delayBetweenLeadsSeconds / 60)}{" "}
          min
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Send in the timezone your leads use. US East Coast is America/New_York.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenSettings("senders")}
          >
            Pick senders
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenSettings("schedule")}
          >
            Timezone & hours
          </Button>
        </div>
        {!senders.length ? (
          <p className="mt-3">
            <Link href="/dashboard/mailbox" className="text-primary">
              Connect Gmail
            </Link>{" "}
            or pick a connected mailbox above.
          </p>
        ) : null}
      </div>

      {campaign.status === "active" || campaign.status === "paused" ? (
        <SendingStatusCard campaign={campaign} onUpdated={onUpdated} />
      ) : null}

      {campaign.status === "active" ? (
        <Button variant="outline" disabled={busy} onClick={() => run("pause")}>
          Pause campaign
        </Button>
      ) : campaign.status === "paused" ? (
        <Button disabled={busy || !canLaunch} onClick={() => run("resume")}>
          {busy ? "Resuming…" : "Resume campaign"}
        </Button>
      ) : campaign.status === "completed" ? (
        <p className="text-sm text-muted-foreground">
          Every lead in this campaign has finished or stopped.
        </p>
      ) : (
        <Button disabled={busy || !canLaunch} onClick={() => run("launch")}>
          {busy ? "Launching…" : "Launch campaign"}
        </Button>
      )}
    </div>
  );
}
