"use client";

import { Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  avatarColor,
  initials,
  newStep,
  senderList,
  stepIsValid,
  waitLabel,
} from "@/lib/campaign/helpers";
import type { Campaign, CampaignStep } from "@/lib/types/campaign";
import { cn } from "@/lib/utils";

export function SequenceCanvas({
  campaign,
  steps,
  selectedKey,
  onSelect,
  onStepsChange,
  onOpenSettings,
}: {
  campaign: Campaign;
  steps: CampaignStep[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onStepsChange: (steps: CampaignStep[]) => void;
  onOpenSettings: (section: "senders" | "schedule") => void;
}) {
  const senders = senderList(campaign);
  const senderLabel = senders[0]?.fromName || senders[0]?.email || "No sender";

  function insertAt(index: number) {
    const next = [...steps];
    next.splice(index, 0, newStep(index, index === 0 ? 0 : 3));
    onStepsChange(next.map((step, order) => ({ ...step, order })));
    onSelect(next[index]!.key!);
  }

  function removeAt(index: number) {
    if (steps.length <= 1) {
      return;
    }
    const next = steps.filter((_, i) => i !== index).map((step, order) => ({
      ...step,
      order,
    }));
    onStepsChange(next);
    onSelect(next[Math.max(0, index - 1)]!.key!);
  }

  function patch(index: number, patchValue: Partial<CampaignStep>) {
    onStepsChange(
      steps.map((step, i) => (i === index ? { ...step, ...patchValue } : step)),
    );
  }

  return (
    <div className="relative min-h-full bg-[radial-gradient(#d9d6ce_1px,transparent_1px)] bg-size-[18px_18px] px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="flex w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <button
            type="button"
            className="flex flex-1 items-center gap-2 px-4 py-3 text-left hover:bg-muted/60"
            onClick={() => onOpenSettings("senders")}
          >
            <span
              className="flex size-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ background: avatarColor(senderLabel) }}
            >
              {senders.length ? initials(senderLabel) : "—"}
            </span>
            <span>
              <span className="block text-[11px] text-muted-foreground">
                Senders
              </span>
              <span className="block truncate text-sm">
                {senders.length ? `${senders.length} selected` : "None"}
              </span>
            </span>
          </button>
          <button
            type="button"
            className="flex flex-1 items-center border-l border-border px-4 py-3 text-left hover:bg-muted/60"
            onClick={() => onOpenSettings("schedule")}
          >
            <span>
              <span className="block text-[11px] text-muted-foreground">
                Schedule
              </span>
              <span className="block truncate text-sm">
                {campaign.sendWindowStart}–{campaign.sendWindowEnd}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {campaign.timezone}
              </span>
            </span>
          </button>
        </div>

        {steps.map((step, index) => {
          const key = step.key || String(index);
          const selected = selectedKey === key;
          const valid = stepIsValid(step);
          return (
            <div key={key} className="flex w-full flex-col items-center">
              <Connector onAdd={() => insertAt(index)} />
              <article
                className={cn(
                  "w-full rounded-xl border bg-card shadow-sm",
                  selected ? "border-primary" : "border-border",
                  !valid && "border-destructive",
                )}
              >
                <div className="flex items-center justify-between px-4 py-2">
                  <WaitControl
                    step={step}
                    onChange={(next) => patch(index, next)}
                  />
                  <div className="flex items-center gap-1">
                    {!valid ? (
                      <TriangleAlert className="size-4 text-destructive" />
                    ) : null}
                    {steps.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => removeAt(index)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="w-full border-t border-border px-4 py-4 text-left"
                  onClick={() => onSelect(key)}
                >
                  <p className="text-sm font-medium">Email</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {step.subject || "No subject yet"}
                  </p>
                </button>
              </article>
            </div>
          );
        })}

        <Connector onAdd={() => insertAt(steps.length)} />
        <Button variant="outline" onClick={() => insertAt(steps.length)}>
          <Plus />
          Add step
        </Button>
      </div>
    </div>
  );
}

function Connector({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="relative flex h-10 w-px items-center justify-center bg-border">
      <button
        type="button"
        onClick={onAdd}
        className="absolute flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}

function WaitControl({
  step,
  onChange,
}: {
  step: CampaignStep;
  onChange: (patch: Partial<CampaignStep>) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger className="text-sm text-primary hover:underline">
        {waitLabel(step)}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <p className="text-xs text-muted-foreground">Wait for</p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() =>
              onChange({ delayValue: Math.max(0, step.delayValue - 1) })
            }
          >
            –
          </Button>
          <Input
            className="w-14 text-center"
            value={step.delayValue}
            onChange={(event) =>
              onChange({ delayValue: Math.max(0, Number(event.target.value) || 0) })
            }
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onChange({ delayValue: step.delayValue + 1 })}
          >
            +
          </Button>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={step.delayUnit}
            onChange={(event) =>
              onChange({
                delayUnit: event.target.value as CampaignStep["delayUnit"],
              })
            }
          >
            <option value="days">days</option>
            <option value="hours">hours</option>
            <option value="minutes">minutes</option>
          </select>
        </div>
        <div className="my-3 h-px bg-border" />
        <label className="flex items-center justify-between gap-3 text-sm">
          No extra wait
          <Switch
            checked={step.delayValue === 0}
            onCheckedChange={(checked) =>
              onChange({ delayValue: checked ? 0 : Math.max(1, step.delayValue) })
            }
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Still waits for the campaign send window and timezone.
        </p>
      </PopoverContent>
    </Popover>
  );
}
