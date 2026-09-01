"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  LEAD_FIELDS,
  leadToPersonalizeValues,
  personalizeTemplate,
  type LeadFieldKey,
} from "@furviou/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyVariableToken,
  matchingLeadFields,
  openVariableQuery,
} from "@/lib/campaign/variables";
import { leadName, senderIds, stepIsValid } from "@/lib/campaign/helpers";
import type { Campaign, CampaignStep } from "@/lib/types/campaign";
import type { Lead } from "@/lib/types/lead";
import type { Mailbox } from "@/lib/types/mailbox";
import { cn } from "@/lib/utils";
import { Braces, Clock, Eye, X } from "lucide-react";

const SAMPLE: Lead = {
  _id: "sample",
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Rivera",
  fullName: "Alex Rivera",
  company: "Northwind",
  city: "New York",
  country: "United States",
  jobTitle: "Founder",
  iceBreaker: "Loved your note about the Brooklyn shop.",
};

type SuggestState = {
  target: "subject" | "body";
  start: number;
  query: string;
  index: number;
};

export function EmailStepEditor({
  campaign,
  step,
  mailboxes,
  previewLead,
  onChange,
  onClose,
  onToggleSender,
  onOpenSettings,
}: {
  campaign: Campaign;
  step: CampaignStep;
  mailboxes: Mailbox[];
  previewLead?: Lead | null;
  onChange: (patch: Partial<CampaignStep>) => void;
  onClose: () => void;
  onToggleSender: (mailboxId: string, selected: boolean) => void;
  onOpenSettings: (section: "senders" | "schedule") => void;
}) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [suggest, setSuggest] = useState<SuggestState | null>(null);
  const selected = new Set(senderIds(campaign));
  const invalid = !stepIsValid(step);
  const lead = previewLead || SAMPLE;
  const values = leadToPersonalizeValues(lead);
  const mappedCount = LEAD_FIELDS.filter((field) => values[field.key]).length;

  function syncSuggest(
    target: "subject" | "body",
    text: string,
    el: HTMLInputElement | HTMLTextAreaElement | null,
  ) {
    const cursor = el?.selectionStart ?? text.length;
    const open = openVariableQuery(text, cursor);
    if (!open) {
      setSuggest(null);
      return;
    }
    setSuggest({
      target,
      start: open.start,
      query: open.query,
      index: 0,
    });
  }

  function pickVariable(key: LeadFieldKey) {
    const target = suggest?.target || "body";
    const el = target === "subject" ? subjectRef.current : bodyRef.current;
    const text = target === "subject" ? step.subject : step.body;
    const cursor = el?.selectionStart ?? text.length;
    const applied = applyVariableToken(text, cursor, key);
    onChange(target === "subject" ? { subject: applied.next } : { body: applied.next });
    setSuggest(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(applied.cursor, applied.cursor);
    });
  }

  const matches = suggest ? matchingLeadFields(suggest.query) : [];

  function onSuggestKey(
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    if (!suggest || !matches.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSuggest({ ...suggest, index: (suggest.index + 1) % matches.length });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSuggest({
        ...suggest,
        index: (suggest.index - 1 + matches.length) % matches.length,
      });
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const field = matches[suggest.index] || matches[0];
      if (field) {
        pickVariable(field.key);
      }
    } else if (event.key === "Escape") {
      setSuggest(null);
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-card md:w-[420px]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="font-medium">Email</p>
          <p className="text-xs text-muted-foreground">Automated</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye />
            Preview
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>Sender</Label>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => onOpenSettings("senders")}
            >
              Manage
            </button>
          </div>
          {mailboxes.length === 0 ? (
            <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              You haven&apos;t connected an account yet.{" "}
              <Link href="/dashboard/mailbox" className="text-primary">
                Connect
              </Link>
            </p>
          ) : (
            <div className="space-y-1 rounded-xl border border-border">
              {mailboxes.map((box) => {
                const healthy =
                  box.status === "connected" && box.hasRefreshToken !== false;
                return (
                <label
                  key={box._id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2"
                >
                  <Switch
                    checked={selected.has(box._id)}
                    disabled={box.status !== "connected"}
                    onCheckedChange={(on) => onToggleSender(box._id, on)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{box.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {healthy ? "Ready to send" : "Needs reconnect"}
                    </p>
                  </div>
                  <Badge variant={healthy ? "secondary" : "destructive"}>
                    {healthy ? "Connected" : "Reconnect"}
                  </Badge>
                </label>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:bg-muted/50"
          onClick={() => onOpenSettings("schedule")}
        >
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Clock className="size-3.5" />
              Timezone & window
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {campaign.sendWindowStart}–{campaign.sendWindowEnd} ·{" "}
              {campaign.timezone}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Use the timezone your leads are in (US East = America/New_York).
            </span>
          </span>
          <span className="text-xs text-primary">Change</span>
        </button>

        {step.order === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            First email starts a new thread.
          </p>
        ) : (
          <div className="space-y-2">
            <Label>Follow-up</Label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                name={`thread-${step.key}`}
                checked={step.sendAsReply}
                onChange={() => onChange({ sendAsReply: true })}
              />
              <span>
                Reply in the last thread
                <span className="block text-xs text-muted-foreground">
                  Default. Same Gmail conversation.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                name={`thread-${step.key}`}
                checked={!step.sendAsReply}
                onChange={() => onChange({ sendAsReply: false })}
              />
              <span>
                Send as a new email
                <span className="block text-xs text-muted-foreground">
                  Starts a separate thread.
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="relative">
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="subject">Subject line</Label>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                subjectRef.current?.focus();
                const cursor = subjectRef.current?.selectionStart ?? step.subject.length;
                const next = `${step.subject.slice(0, cursor)}{{${step.subject.slice(cursor)}`;
                onChange({ subject: next });
                requestAnimationFrame(() => {
                  const el = subjectRef.current;
                  const pos = cursor + 2;
                  el?.setSelectionRange(pos, pos);
                  syncSuggest("subject", next, el);
                });
              }}
            >
              <Braces />
              Variable
            </Button>
          </div>
          <Input
            id="subject"
            ref={subjectRef}
            placeholder="Type {{ to insert a mapped field"
            value={step.subject}
            aria-invalid={invalid && !step.subject.trim()}
            onChange={(event) => {
              onChange({ subject: event.target.value });
              syncSuggest("subject", event.target.value, event.target);
            }}
            onKeyUp={(event) =>
              syncSuggest("subject", event.currentTarget.value, event.currentTarget)
            }
            onClick={(event) =>
              syncSuggest("subject", event.currentTarget.value, event.currentTarget)
            }
            onKeyDown={onSuggestKey}
          />
          {suggest?.target === "subject" ? (
            <VariableMenu
              matches={matches}
              index={suggest.index}
              values={values}
              onPick={pickVariable}
            />
          ) : null}
        </div>

        <div className="relative">
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="body">Message</Label>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                bodyRef.current?.focus();
                const cursor = bodyRef.current?.selectionStart ?? step.body.length;
                const next = `${step.body.slice(0, cursor)}{{${step.body.slice(cursor)}`;
                onChange({ body: next });
                requestAnimationFrame(() => {
                  const el = bodyRef.current;
                  const pos = cursor + 2;
                  el?.setSelectionRange(pos, pos);
                  syncSuggest("body", next, el);
                });
              }}
            >
              <Braces />
              Variable
            </Button>
          </div>
          <Textarea
            id="body"
            ref={bodyRef}
            className={cn("min-h-52", invalid && !step.body.trim() && "border-destructive")}
            placeholder="Start writing. Type {{ to pick firstName, iceBreaker, city…"
            value={step.body}
            aria-invalid={invalid && !step.body.trim()}
            onChange={(event) => {
              onChange({ body: event.target.value });
              syncSuggest("body", event.target.value, event.target);
            }}
            onKeyUp={(event) =>
              syncSuggest("body", event.currentTarget.value, event.currentTarget)
            }
            onClick={(event) =>
              syncSuggest("body", event.currentTarget.value, event.currentTarget)
            }
            onKeyDown={onSuggestKey}
          />
          {suggest?.target === "body" ? (
            <VariableMenu
              matches={matches}
              index={suggest.index}
              values={values}
              onPick={pickVariable}
            />
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {previewLead
              ? `${mappedCount} mapped fields on ${leadName(previewLead)}`
              : "Import leads to preview mapped values. Sample data is shown until then."}
          </p>
          {invalid && !step.body.trim() ? (
            <p className="mt-2 text-xs text-destructive">Your message is empty.</p>
          ) : null}
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Using {leadName(lead)} · {lead.email}
          </p>
          <p className="font-medium">
            {personalizeTemplate(step.subject, values) || "(no subject)"}
          </p>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 font-sans text-sm">
            {personalizeTemplate(step.body, values) || "(empty)"}
          </pre>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function VariableMenu({
  matches,
  index,
  values,
  onPick,
}: {
  matches: { key: LeadFieldKey; label: string }[];
  index: number;
  values: Partial<Record<LeadFieldKey, string>>;
  onPick: (key: LeadFieldKey) => void;
}) {
  return (
    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md">
      {matches.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">No matching field</p>
      ) : (
        matches.map((field, i) => {
          const sample = values[field.key];
          return (
            <button
              key={field.key}
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                i === index ? "bg-primary/10" : "hover:bg-muted",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(field.key);
              }}
            >
              <span>
                <span className="font-medium">{field.label}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  {`{{${field.key}}}`}
                </span>
              </span>
              <span className="max-w-28 truncate text-[11px] text-muted-foreground">
                {sample || "not mapped"}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
