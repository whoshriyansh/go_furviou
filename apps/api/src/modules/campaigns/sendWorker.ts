import type { Types } from "mongoose";
import {
  leadToPersonalizeValues,
  personalizeTemplate,
} from "@furviou/shared";
import Campaign, { type CampaignStep } from "../../models/campaign";
import CampaignLead from "../../models/campaignLead";
import EmailMessage from "../../models/emailMessage";
import Lead from "../../models/lead";
import SendingAccount from "../../models/sendingAccount";
import {
  addDelayThenSlot,
  formatInZone,
  isWithinSendWindow,
  nextSendSlot,
  startOfZonedDay,
  zonedDateKey,
} from "./schedule";
import { leadGapMs, nextStaggeredSlot } from "./sendSlot";
import {
  buildRfcMessage,
  getValidAccessToken,
  markMailboxNeedsReauth,
  sendGmailMessage,
  threadHasLeadReply,
} from "./gmailSend";

import {
  getQueueCounts,
  syncEnrollmentJob,
} from "../../queue/sendQueue";

const LOCK_MS = 2 * 60 * 1000;
let lastTickAt: Date | null = null;
let lastTickDue = 0;
let lastTickSent = 0;
let lastTickHeld = 0;
let lastTickError: string | null = null;

export async function getSendHealth() {
  let queue = {
    wait: 0,
    delayed: 0,
    active: 0,
    completed: 0,
    failed: 0,
    paused: 0,
  };
  try {
    queue = { ...queue, ...(await getQueueCounts()) };
  } catch {
    // Redis not ready yet
  }

  return {
    lastTickAt: lastTickAt?.toISOString() || null,
    lastTickDue,
    lastTickSent,
    lastTickHeld,
    lastTickError,
    intervalMs: Number(
      process.env.SEND_SWEEP_INTERVAL_MS || process.env.SEND_INTERVAL_MS || 30000,
    ),
    queue,
  };
}

async function resetDailyCount(
  account: {
    sentToday: number;
    sentTodayResetAt?: Date;
    save: () => Promise<unknown>;
  },
  timeZone: string,
) {
  const today = zonedDateKey(new Date(), timeZone);
  const marked = account.sentTodayResetAt
    ? zonedDateKey(account.sentTodayResetAt, timeZone)
    : "";
  if (marked !== today) {
    account.sentToday = 0;
    account.sentTodayResetAt = new Date();
    await account.save();
  }
}

async function maybeCompleteCampaign(campaignId: Types.ObjectId) {
  const remaining = await CampaignLead.countDocuments({
    campaignId,
    status: { $in: ["queued", "active"] },
  });
  if (remaining === 0) {
    await Campaign.updateOne(
      { _id: campaignId, status: "active" },
      { $set: { status: "completed" } },
    );
  }
}

export async function processOne(
  enrollmentId: Types.ObjectId,
  options?: { ignoreWindow?: boolean },
) {
  const locked = await CampaignLead.findOneAndUpdate(
    {
      _id: enrollmentId,
      status: { $in: ["queued", "active"] },
      ...(options?.ignoreWindow ? {} : { nextSendAt: { $lte: new Date() } }),
    },
    { $set: { nextSendAt: new Date(Date.now() + LOCK_MS) } },
    { new: true },
  );

  if (!locked) {
    return { status: "skipped" as const, message: "Lead was not due" };
  }

  const campaign = await Campaign.findById(locked.campaignId);
  if (!campaign || campaign.status !== "active") {
    return { status: "skipped" as const, message: "Campaign is not running" };
  }

  const steps = [...(campaign.steps || [])].sort((a, b) => a.order - b.order);
  const step = steps[locked.currentStep] as CampaignStep | undefined;
  if (!step) {
    locked.status = "completed";
    locked.completedAt = new Date();
    locked.nextSendAt = undefined;
    await locked.save();
    await maybeCompleteCampaign(campaign._id);
    return { status: "skipped" as const, message: "No more steps" };
  }

  if (!step.subject.trim() || !step.body.trim()) {
    locked.nextSendAt = nextSendSlot(new Date(Date.now() + 15 * 60 * 1000), campaign);
    locked.lastError = "Sequence step is missing a subject or message";
    await locked.save();
    return { status: "failed" as const, message: locked.lastError };
  }

  if (!options?.ignoreWindow && !isWithinSendWindow(new Date(), campaign)) {
    const next = await nextStaggeredSlot(campaign);
    locked.nextSendAt = next;
    locked.lastError = undefined;
    await locked.save();
    const message = `Outside send window (${campaign.sendWindowStart}–${campaign.sendWindowEnd} ${campaign.timezone}). Next: ${formatInZone(next, campaign.timezone)}`;
    console.info("[send] wait-window", { campaign: String(campaign._id), next: next.toISOString() });
    return { status: "held" as const, message };
  }

  const sentToday = await EmailMessage.countDocuments({
    campaignId: campaign._id,
    status: "sent",
    sentAt: { $gte: startOfZonedDay(new Date(), campaign.timezone) },
  });
  if (sentToday >= campaign.dailySendingLimit) {
    locked.nextSendAt = nextSendSlot(
      new Date(Date.now() + 60 * 60 * 1000),
      campaign,
    );
    await locked.save();
    return { status: "held" as const, message: "Daily campaign send limit reached" };
  }

  const lead = await Lead.findById(locked.leadId);
  if (!lead?.email) {
    locked.status = "failed";
    locked.lastError = "Lead is missing";
    locked.nextSendAt = undefined;
    await locked.save();
    return { status: "failed" as const, message: locked.lastError };
  }

  if (lead.status === "unsubscribed" || lead.status === "bounced") {
    locked.status = lead.status === "bounced" ? "bounced" : "unsubscribed";
    locked.nextSendAt = undefined;
    await locked.save();
    return { status: "skipped" as const, message: `Lead is ${locked.status}` };
  }

  const account = await pickAccount(campaign.sendingAccountIds, locked.sendingAccountId);
  if (!account) {
    locked.nextSendAt = nextSendSlot(new Date(Date.now() + 10 * 60 * 1000), campaign);
    locked.lastError = "No connected mailbox selected for this campaign";
    await locked.save();
    console.error("[send] no-mailbox", { campaign: String(campaign._id) });
    return { status: "failed" as const, message: locked.lastError };
  }

  await resetDailyCount(account, campaign.timezone);
  const gap = leadGapMs(campaign);
  const lastMailboxSend = await EmailMessage.findOne({
    sendingAccountId: account._id,
    status: "sent",
  })
    .sort({ sentAt: -1 })
    .select("sentAt");
  if (
    lastMailboxSend?.sentAt &&
    Date.now() - lastMailboxSend.sentAt.getTime() < gap
  ) {
    const next = nextSendSlot(
      new Date(lastMailboxSend.sentAt.getTime() + gap),
      campaign,
    );
    locked.nextSendAt = next;
    locked.lastError = undefined;
    await locked.save();
    return {
      status: "held" as const,
      message: `Spacing mailbox sends by ${Math.round(gap / 1000)}s`,
    };
  }
  if (account.sentToday >= account.dailyLimit) {
    locked.nextSendAt = nextSendSlot(new Date(Date.now() + 60 * 60 * 1000), campaign);
    locked.lastError = "Mailbox daily limit reached";
    await locked.save();
    return { status: "held" as const, message: locked.lastError };
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(account);
  } catch (error) {
    account.status = "needs_reauth";
    await account.save();
    locked.nextSendAt = nextSendSlot(new Date(Date.now() + 30 * 60 * 1000), campaign);
    locked.lastError = error instanceof Error ? error.message : "Mailbox auth failed";
    await locked.save();
    console.error("[send] auth", locked.lastError);
    return { status: "failed" as const, message: locked.lastError };
  }

  const previous = await EmailMessage.find({
    campaignLeadId: locked._id,
    status: "sent",
  }).sort({ stepOrder: 1 });

  if (campaign.stopOnReply && previous.length > 0) {
    const lastThread = previous[previous.length - 1]?.threadId;
    if (lastThread) {
      try {
        const replied = await threadHasLeadReply({
          accessToken,
          threadId: lastThread,
          leadEmail: lead.email,
          ourSentCount: previous.length,
        });
        if (replied) {
          locked.status = "replied";
          locked.nextSendAt = undefined;
          locked.completedAt = new Date();
          await locked.save();
          await EmailMessage.updateMany(
            { campaignLeadId: locked._id, status: "sent", repliedAt: { $exists: false } },
            { $set: { repliedAt: new Date() } },
          );
          await maybeCompleteCampaign(campaign._id);
          return { status: "skipped" as const, message: "Lead replied" };
        }
      } catch (error) {
        console.error("[send] reply check", error);
      }
    }
  }

  const leadDoc = lead.toObject() as unknown as Record<string, unknown>;
  const values = leadToPersonalizeValues(leadDoc);
  if (!lead.firstName && values.firstName) {
    lead.firstName = values.firstName;
  }
  if (!lead.lastName && values.lastName) {
    lead.lastName = values.lastName;
  }
  if (!lead.fullName && values.fullName) {
    lead.fullName = values.fullName;
  }
  if (lead.isModified()) {
    await lead.save();
  }
  const subject = personalizeTemplate(step.subject, values);
  const bodyText = personalizeTemplate(step.body, values);
  console.info("[send] personalize", {
    to: lead.email,
    lastName: values.lastName || null,
    fullName: values.fullName || null,
    iceBreaker: values.iceBreaker || null,
  });
  const signature = account.signature?.trim();
  const body = signature ? `${bodyText}\n\n${signature}` : bodyText;
  const sendAsReply = step.sendAsReply && previous.length > 0;
  const last = sendAsReply ? previous[previous.length - 1] : undefined;
  const rfcId = `step.${locked._id}.${locked.currentStep}.${Date.now()}@go.furviou.com`;
  const { raw, rfcMessageId } = buildRfcMessage({
    fromName: account.fromName,
    fromEmail: account.email,
    toEmail: lead.email,
    subject: sendAsReply && last?.subject ? last.subject : subject,
    body,
    messageId: rfcId,
    inReplyTo: sendAsReply ? last?.rfcMessageId : undefined,
  });

  const log = await EmailMessage.create({
    campaignId: campaign._id,
    campaignLeadId: locked._id,
    leadId: lead._id,
    sendingAccountId: account._id,
    stepOrder: locked.currentStep,
    subject,
    rfcMessageId,
    status: "queued",
  });

  try {
    const sent = await sendGmailMessage({
      accessToken,
      raw,
      threadId: sendAsReply ? last?.threadId : undefined,
    });

    log.status = "sent";
    log.sentAt = new Date();
    log.providerMessageId = sent.id;
    log.threadId = sent.threadId;
    log.inReplyTo = last?.rfcMessageId;
    await log.save();

    account.sentToday += 1;
    await account.save();

    const nextIndex = locked.currentStep + 1;
    const nextStep = steps[nextIndex];
    locked.sendingAccountId = account._id;
    locked.lastSentAt = new Date();
    locked.lastError = undefined;
    locked.status = "active";

    if (!nextStep) {
      locked.status = "completed";
      locked.completedAt = new Date();
      locked.nextSendAt = undefined;
    } else {
      locked.currentStep = nextIndex;
      locked.nextSendAt = addDelayThenSlot(
        new Date(),
        campaign,
        nextStep.delayValue,
        nextStep.delayUnit,
      );
    }
    await locked.save();
    await maybeCompleteCampaign(campaign._id);
    console.info("[send] sent", {
      campaign: String(campaign._id),
      lead: lead.email,
      step: log.stepOrder,
    });
    return { status: "sent" as const, message: lead.email };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    log.status = "failed";
    log.error = message;
    await log.save();

    if (/invalid|recipient|to header/i.test(message)) {
      locked.status = "bounced";
      lead.status = "invalid";
      await lead.save();
      locked.nextSendAt = undefined;
    } else if (/auth|401|invalid_grant/i.test(message)) {
      await markMailboxNeedsReauth(String(account._id));
      locked.status = "queued";
      locked.nextSendAt = nextSendSlot(new Date(Date.now() + 30 * 60 * 1000), campaign);
    } else if (/rate|429|quota/i.test(message)) {
      locked.status = "queued";
      locked.nextSendAt = nextSendSlot(new Date(Date.now() + 15 * 60 * 1000), campaign);
    } else {
      locked.status = "failed";
      locked.nextSendAt = undefined;
    }
    locked.lastError = message;
    await locked.save();
    console.error("[send] failed", { lead: lead.email, message });
    return { status: "failed" as const, message };
  }
}

async function pickAccount(
  campaignAccountIds: unknown[],
  preferred?: Types.ObjectId,
) {
  const ids = campaignAccountIds
    .map((item) => {
      if (item && typeof item === "object" && "_id" in item) {
        return String((item as { _id: Types.ObjectId })._id);
      }
      return String(item || "");
    })
    .filter((id) => id && id !== "undefined");
  if (!ids.length) {
    return null;
  }

  const preferredId = preferred ? String(preferred) : "";
  const ordered = preferredId && ids.includes(preferredId)
    ? [preferredId, ...ids.filter((id) => id !== preferredId)]
    : ids;

  for (const id of ordered) {
    const account = await SendingAccount.findOne({
      _id: id,
      status: "connected",
      provider: "gmail",
    });
    if (account?.oauth?.accessToken || account?.oauth?.refreshToken) {
      return account;
    }
  }

  return null;
}

export async function processCampaignNow(
  campaignId: Types.ObjectId,
  limit = 8,
) {
  const pending = await CampaignLead.find({
    campaignId,
    status: { $in: ["queued", "active"] },
  })
    .sort({ nextSendAt: 1, createdAt: 1 })
    .limit(limit);

  const results: { status: string; message?: string }[] = [];
  lastTickDue = pending.length;
  lastTickAt = new Date();
  lastTickSent = 0;
  lastTickHeld = 0;
  lastTickError = null;

  for (const row of pending) {
    row.nextSendAt = new Date();
    await row.save();
    const result = await processOne(row._id, { ignoreWindow: true });
    const fresh = await CampaignLead.findById(row._id);
    await syncEnrollmentJob(fresh);
    results.push(result || { status: "skipped" });
    if (result?.status === "sent") {
      lastTickSent += 1;
    } else if (result?.status === "held") {
      lastTickHeld += 1;
    } else if (result?.status === "failed") {
      lastTickError = result.message || "Send failed";
    }
  }
  return results;
}

export function recordSendResult(result: { status: string; message?: string }) {
  lastTickAt = new Date();
  if (result.status === "sent") {
    lastTickSent += 1;
  } else if (result.status === "held") {
    lastTickHeld += 1;
  } else if (result.status === "failed") {
    lastTickError = result.message || "Send failed";
  }
}
