import type { Types } from "mongoose";
import CampaignLead from "../../models/campaignLead";
import EmailMessage from "../../models/emailMessage";
import { nextSendSlot, type Schedule } from "./schedule";

type CampaignSlot = Schedule & {
  _id: Types.ObjectId;
  delayBetweenLeadsSeconds?: number;
};

export function leadGapMs(campaign: { delayBetweenLeadsSeconds?: number }) {
  return Math.max(10, Number(campaign.delayBetweenLeadsSeconds) || 120) * 1000;
}

export async function nextStaggeredSlot(
  campaign: CampaignSlot,
  from = new Date(),
) {
  const gap = leadGapMs(campaign);
  const windowOpen = nextSendSlot(from, campaign);

  const lastPlanned = await CampaignLead.findOne({
    campaignId: campaign._id,
    status: { $in: ["queued", "active"] },
    nextSendAt: { $exists: true, $ne: null },
  })
    .sort({ nextSendAt: -1 })
    .select("nextSendAt");

  const lastSent = await EmailMessage.findOne({
    campaignId: campaign._id,
    status: "sent",
  })
    .sort({ sentAt: -1 })
    .select("sentAt");

  let at = windowOpen.getTime();
  if (lastPlanned?.nextSendAt) {
    at = Math.max(at, lastPlanned.nextSendAt.getTime() + gap);
  }
  if (lastSent?.sentAt) {
    at = Math.max(at, lastSent.sentAt.getTime() + gap);
  }
  return nextSendSlot(new Date(at), campaign);
}

/** Spread remaining queued/active leads so they never share the same send minute. */
export async function restaggerPendingLeads(campaign: CampaignSlot) {
  const pending = await CampaignLead.find({
    campaignId: campaign._id,
    status: { $in: ["queued", "active"] },
  }).sort({ lastSentAt: 1, createdAt: 1 });

  const gap = leadGapMs(campaign);
  let slot = nextSendSlot(new Date(), campaign);
  const lastSent = await EmailMessage.findOne({
    campaignId: campaign._id,
    status: "sent",
  })
    .sort({ sentAt: -1 })
    .select("sentAt");

  if (lastSent?.sentAt) {
    const afterLast = new Date(lastSent.sentAt.getTime() + gap);
    if (afterLast.getTime() > slot.getTime()) {
      slot = nextSendSlot(afterLast, campaign);
    }
  }

  for (const enrollment of pending) {
    enrollment.nextSendAt = slot;
    enrollment.lastError = undefined;
    await enrollment.save();
    slot = nextSendSlot(new Date(slot.getTime() + gap), campaign);
  }

  return { count: pending.length, firstAt: pending[0]?.nextSendAt, lastAt: pending[pending.length - 1]?.nextSendAt };
}
