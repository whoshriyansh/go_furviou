"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendNowCampaign } from "@/lib/api/campaigns";
import { enrollmentLabel, leadName } from "@/lib/campaign/helpers";
import type { Campaign } from "@/lib/types/campaign";

const STAT_KEYS = [
  ["sent", "Sent"],
  ["queued", "To launch"],
  ["active", "In sequence"],
  ["replied", "Replied"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["bounced", "Bounced"],
] as const;

export function PerformanceTab({
  campaign,
  onUpdated,
}: {
  campaign: Campaign;
  onUpdated: (campaign: Campaign) => void;
}) {
  const stats = campaign.stats;
  const recent = campaign.recentSends || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="font-heading text-2xl">Performance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Counts update as the sender runs. Opens and clicks are not tracked yet.
        </p>
      </div>

      <SendingStatusCard campaign={campaign} onUpdated={onUpdated} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads" value={stats?.total ?? 0} />
        {STAT_KEYS.map(([key, label]) => (
          <StatCard key={key} label={label} value={stats?.[key] ?? 0} />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <p className="border-b border-border px-4 py-3 text-sm font-medium">
          Recent sends
        </p>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Nothing sent yet. If the campaign is running, it is waiting for the
            send window unless you use Send now (test).
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {recent.map((row) => (
              <li key={row._id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">
                    {row.leadId && typeof row.leadId === "object"
                      ? `${leadName(row.leadId)} · ${row.leadId.email}`
                      : "Lead"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {enrollmentLabel(row.status)} · step {row.stepOrder + 1}
                  </span>
                </div>
                {row.error ? (
                  <p className="mt-1 text-xs text-destructive">{row.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SendingStatusCard({
  campaign,
  onUpdated,
}: {
  campaign: Campaign;
  onUpdated: (campaign: Campaign) => void;
}) {
  const [busy, setBusy] = useState(false);
  const sending = campaign.sending;
  const worker = sending?.worker;

  async function sendNow() {
    setBusy(true);
    try {
      const result = await sendNowCampaign(campaign._id, 1);
      onUpdated(result.campaign);
      const first = result.results[0];
      if (result.sent) {
        toast.success(
          `Sent to ${first?.message || "the next lead"}. Check Gmail Sent and Performance.`,
        );
      } else if (result.failed) {
        toast.error(first?.message || "Send failed");
      } else if (result.held) {
        toast.message(first?.message || "Held for a send limit");
      } else {
        toast.message(first?.message || "No lead was ready to send");
      }
    } catch {
      // interceptor
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <p className="text-sm font-medium">Sending status</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {sending?.reason ||
              (campaign.status === "active"
                ? "Campaign is running. Refresh Performance if this stays empty."
                : "Launch the campaign to start sending.")}
          </p>
          {sending?.nextLeadLabel ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Next send: {sending.nextLeadLabel}
            </p>
          ) : null}
          {sending?.lastError ? (
            <p className="mt-2 text-xs text-destructive">{sending.lastError}</p>
          ) : null}
          {worker?.lastTickAt ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sender last checked{" "}
              {new Date(worker.lastTickAt).toLocaleTimeString()} · due{" "}
              {worker.lastTickDue} · sent {worker.lastTickSent}
              {worker.lastTickError ? ` · ${worker.lastTickError}` : ""}
            </p>
          ) : campaign.status === "active" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sender checks about every 20 seconds.
            </p>
          ) : null}
        </div>
        {campaign.status === "active" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={sendNow}
          >
            {busy ? "Sending…" : "Send now (test)"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-medium">{value}</p>
    </div>
  );
}
