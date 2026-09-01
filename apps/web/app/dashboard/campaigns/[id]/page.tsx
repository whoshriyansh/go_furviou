"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignLeadsTab } from "@/components/campaign/CampaignLeadsTab";
import { CampaignSettingsSheet } from "@/components/campaign/CampaignSettingsSheet";
import { EmailStepEditor } from "@/components/campaign/EmailStepEditor";
import { LaunchTab } from "@/components/campaign/LaunchTab";
import { PerformanceTab } from "@/components/campaign/PerformanceTab";
import { SequenceCanvas } from "@/components/campaign/SequenceCanvas";
import { getCampaign, listCampaignLeads, updateCampaign } from "@/lib/api/campaigns";
import { listMailboxes } from "@/lib/api/mailbox";
import {
  senderIds,
  sequenceIsReady,
  withStepKeys,
} from "@/lib/campaign/helpers";
import type { Campaign, CampaignStep, CampaignTab } from "@/lib/types/campaign";
import type { Lead } from "@/lib/types/lead";
import type { Mailbox } from "@/lib/types/mailbox";

const TABS: { id: CampaignTab; label: string }[] = [
  { id: "sequence", label: "Sequence" },
  { id: "leads", label: "Leads list" },
  { id: "launch", label: "Launch" },
  { id: "performance", label: "Performance" },
];

export default function CampaignBuilderPage() {
  const params = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<CampaignTab>("sequence");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"senders" | "schedule">(
    "senders",
  );
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const dirtyRef = useRef(false);
  const autoSelectedRef = useRef(false);
  dirtyRef.current = dirty;

  const applyCampaign = useCallback((next: Campaign, overwriteSteps = false) => {
    setCampaign(next);
    setName(next.name);
    if (overwriteSteps || !dirtyRef.current) {
      const keyed = withStepKeys(next.steps || []);
      setSteps(keyed);
      setDirty(false);
      setSelectedKey((current) => current || keyed[0]?.key || null);
    }
  }, []);

  const load = useCallback(async () => {
    const next = await getCampaign(params.id);
    applyCampaign(next, true);
  }, [applyCampaign, params.id]);

  useEffect(() => {
    load().catch(() => undefined);
    listMailboxes()
      .then(setMailboxes)
      .catch(() => undefined);
    listCampaignLeads(params.id, { page: 1, limit: 1 })
      .then((data) => setPreviewLead(data.leads[0] || null))
      .catch(() => undefined);
  }, [load, params.id]);

  useEffect(() => {
    if (!campaign || autoSelectedRef.current || mailboxes.length === 0) {
      return;
    }
    if (senderIds(campaign).length > 0) {
      autoSelectedRef.current = true;
      return;
    }
    const ready = mailboxes.filter(
      (box) => box.provider === "gmail" && box.status === "connected",
    );
    if (!ready.length) {
      return;
    }
    autoSelectedRef.current = true;
    updateCampaign(campaign._id, {
      sendingAccountIds: ready.map((box) => box._id),
    })
      .then((next) => applyCampaign(next, false))
      .catch(() => {
        autoSelectedRef.current = false;
      });
  }, [applyCampaign, campaign, mailboxes]);

  useEffect(() => {
    if (campaign?.status !== "active") {
      return;
    }
    const timer = setInterval(() => {
      getCampaign(params.id)
        .then((next) => applyCampaign(next, false))
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [applyCampaign, campaign?.status, params.id]);

  const selected = useMemo(
    () => steps.find((step) => step.key === selectedKey) || null,
    [steps, selectedKey],
  );
  const ready = sequenceIsReady(steps);
  const leadCount = campaign?.stats?.total || 0;

  async function saveSequence() {
    if (!campaign) {
      return;
    }
    setSaving(true);
    try {
      const next = await updateCampaign(campaign._id, {
        name: name.trim() || campaign.name,
        steps: steps.map((step, order) => ({
          order,
          delayValue: step.delayValue,
          delayUnit: step.delayUnit,
          subject: step.subject,
          body: step.body,
          sendAsReply: step.sendAsReply,
        })),
      });
      applyCampaign(next, true);
      toast.success("Sequence saved");
    } finally {
      setSaving(false);
    }
  }

  function openSettings(section: "senders" | "schedule") {
    setSettingsSection(section);
    setSettingsOpen(true);
  }

  function nextTab() {
    const index = TABS.findIndex((item) => item.id === tab);
    const following = TABS[index + 1];
    if (following) {
      setTab(following.id);
    }
  }

  if (!campaign) {
    return (
      <div className="-m-8 flex h-[calc(100%+4rem)] items-center justify-center text-sm text-muted-foreground">
        Loading campaign…
      </div>
    );
  }

  return (
      <div className="-m-8 flex h-[calc(100%+4rem)] flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2">
        <Input
          className="h-8 max-w-64 border-transparent bg-transparent px-1 text-sm font-medium shadow-none focus-visible:border-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== campaign.name) {
              updateCampaign(campaign._id, { name: name.trim() })
                .then((next) => applyCampaign(next, false))
                .catch(() => undefined);
            }
          }}
        />
        <Badge variant="secondary" className="capitalize">
          {campaign.status}
        </Badge>
        {campaign.status === "active" && campaign.sending && !campaign.sending.inWindow ? (
          <span className="hidden max-w-xs truncate text-xs text-muted-foreground sm:inline">
            Waiting until {campaign.sending.nextLeadLabel || "the send window"}
          </span>
        ) : null}
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as CampaignTab)}
          className="ml-auto"
        >
          <TabsList variant="line" className="h-9 bg-transparent">
            {TABS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="px-3">
                {item.id === "sequence" && !ready ? (
                  <AlertCircle className="text-destructive" />
                ) : null}
                {item.label}
                {item.id === "launch" && leadCount ? (
                  <span className="text-muted-foreground">{leadCount}</span>
                ) : null}
                {item.id === "performance" && (campaign.stats?.sent ?? 0) ? (
                  <span className="text-muted-foreground">{campaign.stats?.sent}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" disabled={saving} onClick={saveSequence}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          disabled={tab === "performance"}
          onClick={nextTab}
        >
          Next step
          <ChevronRight />
        </Button>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/dashboard/campaigns">
            <X />
          </Link>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {tab === "sequence" ? (
          <>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <SequenceCanvas
                campaign={campaign}
                steps={steps}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                onOpenSettings={openSettings}
                onStepsChange={(next) => {
                  setSteps(next);
                  setDirty(true);
                }}
              />
            </div>
            {selected ? (
              <EmailStepEditor
                campaign={campaign}
                step={selected}
                mailboxes={mailboxes}
                previewLead={previewLead}
                onClose={() => setSelectedKey(null)}
                onOpenSettings={openSettings}
                onToggleSender={async (mailboxId, on) => {
                  const current = senderIds(campaign);
                  const nextIds = on
                    ? [...new Set([...current, mailboxId])]
                    : current.filter((id) => id !== mailboxId);
                  try {
                    const next = await updateCampaign(campaign._id, {
                      sendingAccountIds: nextIds,
                    });
                    applyCampaign(next, false);
                  } catch {
                    // interceptor
                  }
                }}
                onChange={(patch) => {
                  setSteps((current) =>
                    current.map((step) =>
                      step.key === selected.key ? { ...step, ...patch } : step,
                    ),
                  );
                  setDirty(true);
                }}
              />
            ) : null}
          </>
        ) : null}

        {tab === "leads" ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <CampaignLeadsTab
              campaign={campaign}
              onChanged={() => {
                getCampaign(campaign._id)
                  .then((next) => applyCampaign(next, false))
                  .catch(() => undefined);
                listCampaignLeads(campaign._id, { page: 1, limit: 1 })
                  .then((data) => setPreviewLead(data.leads[0] || null))
                  .catch(() => undefined);
              }}
            />
          </div>
        ) : null}

        {tab === "launch" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <LaunchTab
              campaign={campaign}
              steps={steps}
              onUpdated={(next) => applyCampaign(next, true)}
              onSaveSequence={saveSequence}
              onOpenSettings={openSettings}
            />
          </div>
        ) : null}

        {tab === "performance" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <PerformanceTab
              campaign={campaign}
              onUpdated={(next) => applyCampaign(next, false)}
            />
          </div>
        ) : null}
      </div>

      <CampaignSettingsSheet
        campaign={campaign}
        mailboxes={mailboxes}
        open={settingsOpen}
        section={settingsSection}
        onOpenChange={setSettingsOpen}
        onSaved={(next) => applyCampaign(next, false)}
      />
    </div>
  );
}
