import type { Campaign, CampaignSender, CampaignStep } from "@/lib/types/campaign";
import type { Lead } from "@/lib/types/lead";

const AVATAR_COLORS = [
  "#2b4cdb",
  "#c9a227",
  "#0f766e",
  "#7c3aed",
  "#b45309",
  "#be123c",
];

export function newStep(order: number, delayValue = 0): CampaignStep {
  return {
    key: crypto.randomUUID(),
    order,
    delayValue,
    delayUnit: "days",
    subject: "",
    body: "",
    sendAsReply: order > 0,
  };
}

export function withStepKeys(steps: CampaignStep[]) {
  if (!steps.length) {
    return [newStep(0)];
  }
  return steps.map((step, index) => ({
    ...step,
    order: index,
    sendAsReply: index === 0 ? false : step.sendAsReply !== false,
    key: step.key || step._id || crypto.randomUUID(),
  }));
}

export function stepIsValid(step: CampaignStep) {
  return Boolean(step.subject.trim() && step.body.trim());
}

export function sequenceIsReady(steps: CampaignStep[]) {
  return steps.length > 0 && steps.every(stepIsValid);
}

export function waitLabel(step: CampaignStep) {
  if (!step.delayValue) {
    return "No extra wait";
  }
  const unit =
    step.delayValue === 1 ? step.delayUnit.slice(0, -1) : step.delayUnit;
  return `Wait for ${step.delayValue} ${unit}`;
}

export function formatInCampaignZone(iso: string | undefined, timeZone: string) {
  if (!iso) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function senderList(campaign: Campaign): CampaignSender[] {
  return (campaign.sendingAccountIds || []).filter(
    (item): item is CampaignSender =>
      typeof item === "object" && item !== null && "_id" in item,
  );
}

export function senderIds(campaign: Campaign) {
  return (campaign.sendingAccountIds || [])
    .map((item) => (typeof item === "string" ? item : item?._id))
    .filter((id): id is string => Boolean(id));
}

export function leadName(lead: Pick<Lead, "firstName" | "lastName" | "fullName" | "email">) {
  return (
    lead.fullName ||
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email
  );
}

export function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase() || "•";
}

export function avatarColor(label: string) {
  let hash = 0;
  for (const char of label) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function enrollmentLabel(status?: string) {
  switch (status) {
    case "queued":
      return "To launch";
    case "active":
      return "In sequence";
    case "paused":
      return "Paused";
    case "replied":
      return "Replied";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "bounced":
      return "Bounced";
    case "unsubscribed":
      return "Unsubscribed";
    default:
      return status || "—";
  }
}

export const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;
