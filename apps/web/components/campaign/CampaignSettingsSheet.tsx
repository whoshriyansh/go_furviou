"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { listTimeZones } from "@furviou/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { updateCampaign } from "@/lib/api/campaigns";
import { DAYS, senderIds } from "@/lib/campaign/helpers";
import type { Campaign } from "@/lib/types/campaign";
import type { Mailbox } from "@/lib/types/mailbox";
import { cn } from "@/lib/utils";

type Section = "senders" | "schedule";

export function CampaignSettingsSheet({
  campaign,
  mailboxes,
  open,
  section,
  onOpenChange,
  onSaved,
}: {
  campaign: Campaign;
  mailboxes: Mailbox[];
  open: boolean;
  section: Section;
  onOpenChange: (open: boolean) => void;
  onSaved: (campaign: Campaign) => void;
}) {
  const [tab, setTab] = useState<Section>(section);
  const [selected, setSelected] = useState<string[]>([]);
  const [timezone, setTimezone] = useState(campaign.timezone);
  const [sendDays, setSendDays] = useState<string[]>(campaign.sendDays);
  const [windowStart, setWindowStart] = useState(campaign.sendWindowStart);
  const [windowEnd, setWindowEnd] = useState(campaign.sendWindowEnd);
  const [gapMinutes, setGapMinutes] = useState(
    Math.max(1, Math.round(campaign.delayBetweenLeadsSeconds / 60)),
  );
  const [dailyLimit, setDailyLimit] = useState(campaign.dailySendingLimit);
  const [autoEnroll, setAutoEnroll] = useState(campaign.autoEnrollNewLeads);
  const [stopOnReply, setStopOnReply] = useState(campaign.stopOnReply);
  const [saving, setSaving] = useState(false);
  const [zoneQuery, setZoneQuery] = useState("");
  const zones = listTimeZones().filter((zone) =>
    zone.toLowerCase().includes(zoneQuery.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setTab(section);
    setSelected(senderIds(campaign));
    setTimezone(campaign.timezone);
    setSendDays(campaign.sendDays);
    setWindowStart(campaign.sendWindowStart);
    setWindowEnd(campaign.sendWindowEnd);
    setGapMinutes(Math.max(1, Math.round(campaign.delayBetweenLeadsSeconds / 60)));
    setDailyLimit(campaign.dailySendingLimit);
    setAutoEnroll(campaign.autoEnrollNewLeads);
    setStopOnReply(campaign.stopOnReply);
    setZoneQuery("");
  }, [open, section, campaign]);

  async function save() {
    setSaving(true);
    try {
      const next = await updateCampaign(campaign._id, {
        sendingAccountIds: selected,
        timezone,
        sendDays,
        sendWindowStart: windowStart,
        sendWindowEnd: windowEnd,
        delayBetweenLeadsSeconds: gapMinutes * 60,
        dailySendingLimit: dailyLimit,
        autoEnrollNewLeads: autoEnroll,
        stopOnReply,
      });
      toast.success("Settings saved");
      onSaved(next);
      onOpenChange(false);
    } catch {
      // interceptor
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Campaign settings</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-4 pb-4">
          <nav className="w-44 shrink-0 space-y-1">
            {(
              [
                ["senders", "Senders"],
                ["schedule", "Schedules & launch"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm",
                  tab === key
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            {tab === "senders" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Sending accounts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Furviou rotates selected inboxes evenly so no one mailbox
                    takes the full load.
                  </p>
                </div>

                {mailboxes.length === 0 ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                    You haven&apos;t connected an account yet.{" "}
                    <Link href="/dashboard/mailbox" className="text-primary">
                      Connect
                    </Link>
                  </div>
                ) : null}

                <div className="divide-y divide-border rounded-xl border border-border">
                  {mailboxes.map((box) => {
                    const checked = selected.includes(box._id);
                    return (
                      <label
                        key={box._id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-3"
                      >
                        <Switch
                          checked={checked}
                          onCheckedChange={(on) =>
                            setSelected((current) =>
                              on
                                ? [...current, box._id]
                                : current.filter((id) => id !== box._id),
                            )
                          }
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {box.fromName || box.email}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {box.email} · {box.status}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">Auto launch</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      New CSV imports start sending if this campaign is already
                      running.
                    </p>
                  </div>
                  <Switch checked={autoEnroll} onCheckedChange={setAutoEnroll} />
                </div>

                <div>
                  <h3 className="font-medium">Send window</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Emails only go out on these days, in this timezone. For US
                    clients pick America/New_York, Chicago, Denver, or Los_Angeles
                    — not your laptop timezone unless they match.
                  </p>
                </div>

                <div className="space-y-4 rounded-xl border border-border p-4">
                  <div>
                    <Label className="mb-2">Send on</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => {
                        const checked = sendDays.includes(day.key);
                        return (
                          <label
                            key={day.key}
                            className="flex items-center gap-1.5 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(on) =>
                                setSendDays((current) =>
                                  on
                                    ? [...current, day.key]
                                    : current.filter((item) => item !== day.key),
                                )
                              }
                            />
                            {day.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="window-start">Send between</Label>
                      <Input
                        id="window-start"
                        type="time"
                        className="mt-1"
                        value={windowStart}
                        onChange={(event) => setWindowStart(event.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="window-end">And</Label>
                      <Input
                        id="window-end"
                        type="time"
                        className="mt-1"
                        value={windowEnd}
                        onChange={(event) => setWindowEnd(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="gap">Reach a new lead every</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() =>
                            setGapMinutes((value) => Math.max(1, value - 1))
                          }
                        >
                          –
                        </Button>
                        <Input
                          id="gap"
                          className="w-16 text-center"
                          value={gapMinutes}
                          onChange={(event) =>
                            setGapMinutes(
                              Math.max(1, Number(event.target.value) || 1),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setGapMinutes((value) => value + 1)}
                        >
                          +
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          minutes
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="daily">Daily sending limit</Label>
                      <Input
                        id="daily"
                        type="number"
                        min={1}
                        max={500}
                        className="mt-1"
                        value={dailyLimit}
                        onChange={(event) =>
                          setDailyLimit(
                            Math.max(1, Number(event.target.value) || 1),
                          )
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      className="mt-1"
                      placeholder="Search America/New_York, Asia/Kolkata…"
                      value={zoneQuery}
                      onChange={(event) => setZoneQuery(event.target.value)}
                    />
                    <select
                      id="timezone"
                      className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                      value={timezone}
                      onChange={(event) => setTimezone(event.target.value)}
                    >
                      {zones.includes(timezone) ? null : (
                        <option value={timezone}>{timezone}</option>
                      )}
                      {zones.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">Stop on reply</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      If they answer, remaining follow-ups are skipped.
                    </p>
                  </div>
                  <Switch checked={stopOnReply} onCheckedChange={setStopOnReply} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-border px-4 py-3">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
