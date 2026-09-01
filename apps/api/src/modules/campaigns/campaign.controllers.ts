import type { Request, Response } from "express";
import { Types } from "mongoose";
import { safeTimeZone } from "@furviou/shared";
import Campaign, {
  type CampaignStep,
  type DayOfWeek,
} from "../../models/campaign";
import CampaignLead from "../../models/campaignLead";
import EmailMessage from "../../models/emailMessage";
import SendingAccount from "../../models/sendingAccount";
import { addDelayThenSlot, formatInZone, isWithinSendWindow, nextSendSlot } from "./schedule";
import { getSendHealth, processCampaignNow } from "./sendWorker";

const SENDER_SELECT = "email provider status fromName";
const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function defaultSteps(): CampaignStep[] {
  return [
    {
      order: 0,
      delayValue: 0,
      delayUnit: "days",
      subject: "",
      body: "",
      sendAsReply: false,
    },
  ];
}

function isSequenceComplete(steps?: CampaignStep[]) {
  return Boolean(
    steps?.length &&
      steps.every((step) => step.subject?.trim() && step.body?.trim()),
  );
}

function emptyStats() {
  return {
    total: 0,
    queued: 0,
    active: 0,
    paused: 0,
    completed: 0,
    replied: 0,
    failed: 0,
    bounced: 0,
    unsubscribed: 0,
    sent: 0,
  };
}

async function statsForCampaigns(ids: Types.ObjectId[]) {
  const map = new Map<string, ReturnType<typeof emptyStats>>();
  for (const id of ids) {
    map.set(String(id), emptyStats());
  }

  if (!ids.length) {
    return map;
  }

  const grouped = await CampaignLead.aggregate<{
    _id: { campaignId: Types.ObjectId; status: string };
    count: number;
  }>([
    { $match: { campaignId: { $in: ids } } },
    {
      $group: {
        _id: { campaignId: "$campaignId", status: "$status" },
        count: { $sum: 1 },
      },
    },
  ]);

  for (const row of grouped) {
    const stats = map.get(String(row._id.campaignId));
    if (!stats) {
      continue;
    }
    stats.total += row.count;
    const key = row._id.status as keyof ReturnType<typeof emptyStats>;
    if (key in stats && key !== "total" && key !== "sent") {
      stats[key] += row.count;
    }
  }

  const sentRows = await EmailMessage.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { campaignId: { $in: ids }, status: "sent" } },
    { $group: { _id: "$campaignId", count: { $sum: 1 } } },
  ]);

  for (const row of sentRows) {
    const stats = map.get(String(row._id));
    if (stats) {
      stats.sent = row.count;
    }
  }

  return map;
}

function serializeCampaign(
  campaign: { toObject: () => Record<string, unknown> },
  stats?: ReturnType<typeof emptyStats>,
  extra?: Record<string, unknown>,
) {
  const object = campaign.toObject();
  const steps = (object.steps as CampaignStep[] | undefined)?.length
    ? (object.steps as CampaignStep[])
    : defaultSteps();

  return {
    ...object,
    steps,
    autoEnrollNewLeads: Boolean(object.autoEnrollNewLeads),
    sendingAccountIds: object.sendingAccountIds || [],
    sequenceComplete: isSequenceComplete(
      (object.steps as CampaignStep[] | undefined) || [],
    ),
    stats,
    ...extra,
  };
}

async function campaignPayload(
  campaign: {
    toObject: () => Record<string, unknown>;
    _id: Types.ObjectId;
    status: string;
    timezone: string;
    sendDays: DayOfWeek[];
    sendWindowStart: string;
    sendWindowEnd: string;
  },
  extra?: Record<string, unknown>,
) {
  const statsMap = await statsForCampaigns([campaign._id]);
  const sending = await buildSendingStatus(campaign);
  return serializeCampaign(campaign, statsMap.get(String(campaign._id)), {
    sending,
    ...extra,
  });
}

async function ownedCampaign(userId: string, id: string) {
  return Campaign.findOne({ _id: id, createdBy: userId }).populate(
    "sendingAccountIds",
    SENDER_SELECT,
  );
}

async function buildSendingStatus(campaign: {
  _id: Types.ObjectId;
  status: string;
  timezone: string;
  sendDays: DayOfWeek[];
  sendWindowStart: string;
  sendWindowEnd: string;
}) {
  const now = new Date();
  const inWindow = isWithinSendWindow(now, campaign);
  const nextSlot = nextSendSlot(now, campaign);
  const soonest = await CampaignLead.findOne({
    campaignId: campaign._id,
    status: { $in: ["queued", "active"] },
    nextSendAt: { $exists: true, $ne: null },
  })
    .sort({ nextSendAt: 1 })
    .select("nextSendAt lastError status");

  const dueCount = await CampaignLead.countDocuments({
    campaignId: campaign._id,
    status: { $in: ["queued", "active"] },
    nextSendAt: { $lte: now },
  });

  const nextLeadAt = soonest?.nextSendAt || (campaign.status === "active" ? nextSlot : null);
  let reason = "Not launched yet.";
  if (campaign.status === "paused") {
    reason = "Campaign is paused.";
  } else if (campaign.status === "completed") {
    reason = "Every lead has finished or stopped.";
  } else if (campaign.status === "active" && !inWindow) {
    reason = `Outside send window (${campaign.sendWindowStart}–${campaign.sendWindowEnd} ${campaign.timezone}). Next send ${formatInZone(nextLeadAt || nextSlot, campaign.timezone)}. "Send immediately" still waits for this window.`;
  } else if (campaign.status === "active" && dueCount > 0) {
    reason = `${dueCount} lead(s) are due. The sender checks every 20 seconds.`;
  } else if (campaign.status === "active" && nextLeadAt) {
    reason = `Waiting until ${formatInZone(nextLeadAt, campaign.timezone)}.`;
  } else if (campaign.status === "active") {
    reason = "Running. No leads are waiting to send.";
  }

  return {
    inWindow,
    timezone: campaign.timezone,
    sendWindowStart: campaign.sendWindowStart,
    sendWindowEnd: campaign.sendWindowEnd,
    nextSlot: nextSlot.toISOString(),
    nextLeadAt: nextLeadAt ? nextLeadAt.toISOString() : null,
    nextLeadLabel: nextLeadAt ? formatInZone(nextLeadAt, campaign.timezone) : null,
    dueCount,
    lastError: soonest?.lastError || null,
    worker: getSendHealth(),
    reason,
  };
}

function sanitizeSteps(raw: unknown): CampaignStep[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, 20).map((step, index) => {
    const row = (step || {}) as Record<string, unknown>;
    const unit = String(row.delayUnit || "days");
    return {
      order: index,
      delayValue: Math.max(0, Number(row.delayValue) || 0),
      delayUnit:
        unit === "minutes" || unit === "hours" || unit === "days"
          ? unit
          : "days",
      subject: String(row.subject || "").slice(0, 500),
      body: String(row.body || "").slice(0, 20000),
      sendAsReply: index === 0 ? false : row.sendAsReply !== false,
    };
  });
}

function sanitizeDays(raw: unknown): DayOfWeek[] {
  if (!Array.isArray(raw)) {
    return ["monday", "tuesday", "wednesday", "thursday", "friday"];
  }
  const next = raw.filter((day): day is DayOfWeek =>
    DAYS.includes(day as DayOfWeek),
  );
  return next.length ? next : ["monday", "tuesday", "wednesday", "thursday", "friday"];
}

function sanitizeWindow(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

async function resolveSenderIds(userId: string, raw: unknown) {
  if (!Array.isArray(raw)) {
    return null;
  }

  const unique = [
    ...new Set(
      raw
        .map((id) => String(id))
        .filter((id) => Types.ObjectId.isValid(id)),
    ),
  ];

  if (!unique.length) {
    return [] as Types.ObjectId[];
  }

  const found = await SendingAccount.find({
    _id: { $in: unique },
    createdBy: userId,
  }).select("_id");

  if (found.length !== unique.length) {
    throw new Error("One of the selected mailboxes does not belong to you");
  }

  return unique.map((id) => new Types.ObjectId(id));
}

function senderObjectIds(campaign: {
  sendingAccountIds: unknown[];
}) {
  return campaign.sendingAccountIds
    .map((item) => {
      if (item && typeof item === "object" && "_id" in item) {
        return (item as { _id: Types.ObjectId })._id;
      }
      return item as Types.ObjectId;
    })
    .filter(Boolean);
}

export async function scheduleEnrollments(
  campaign: {
    _id: Types.ObjectId;
    steps: CampaignStep[];
    sendingAccountIds: unknown[];
    delayBetweenLeadsSeconds: number;
    timezone: string;
    sendDays: DayOfWeek[];
    sendWindowStart: string;
    sendWindowEnd: string;
  },
  options?: { resetSteps?: boolean },
) {
  const accountIds = senderObjectIds(campaign);
  if (!accountIds.length) {
    throw new Error("Select at least one mailbox");
  }

  const enrollments = await CampaignLead.find({
    campaignId: campaign._id,
    status: { $in: ["queued", "active", "paused"] },
  }).sort({ createdAt: 1 });

  const first = [...(campaign.steps || [])].sort((a, b) => a.order - b.order)[0];
  let slot = first
    ? addDelayThenSlot(
        new Date(),
        campaign,
        first.delayValue,
        first.delayUnit,
      )
    : nextSendSlot(new Date(), campaign);

  let index = 0;
  for (const enrollment of enrollments) {
    if (options?.resetSteps) {
      enrollment.currentStep = 0;
    }
    if (enrollment.status === "paused") {
      enrollment.status = "queued";
    }
    enrollment.sendingAccountId = accountIds[index % accountIds.length];
    enrollment.nextSendAt = slot;
    enrollment.lastError = undefined;
    await enrollment.save();
    index += 1;
    slot = nextSendSlot(
      new Date(slot.getTime() + campaign.delayBetweenLeadsSeconds * 1000),
      campaign,
    );
  }

  return enrollments.length;
}

export async function createCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "Campaign name is required" });
  }

  const campaign = await Campaign.create({
    createdBy: req.user.id,
    name,
    description: String(req.body?.description || "").trim() || undefined,
    status: "draft",
    timezone: safeTimeZone(req.body?.timezone, "UTC"),
    steps: defaultSteps(),
  });

  return res.status(201).json({
    campaign: serializeCampaign(campaign, emptyStats()),
  });
}

export async function listCampaigns(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaigns = await Campaign.find({ createdBy: req.user.id })
    .populate("sendingAccountIds", SENDER_SELECT)
    .sort({ createdAt: -1 });

  const statsMap = await statsForCampaigns(campaigns.map((row) => row._id));

  return res.json({
    campaigns: campaigns.map((campaign) =>
      serializeCampaign(campaign, statsMap.get(String(campaign._id))),
    ),
  });
}

export async function getCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await ownedCampaign(req.user.id, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  const recentSends = await EmailMessage.find({ campaignId: campaign._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("leadId", "email firstName lastName fullName");

  return res.json({
    campaign: await campaignPayload(campaign, { recentSends }),
  });
}

export async function updateCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await Campaign.findOne({
    _id: req.params.id,
    createdBy: req.user.id,
  });
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  try {
    if (req.body?.name !== undefined) {
      const name = String(req.body.name || "").trim();
      if (!name) {
        return res.status(400).json({ message: "Campaign name is required" });
      }
      campaign.name = name;
    }

    if (req.body?.description !== undefined) {
      campaign.description =
        String(req.body.description || "").trim() || undefined;
    }

    if (req.body?.steps !== undefined) {
      const steps = sanitizeSteps(req.body.steps);
      campaign.steps = steps.length ? steps : defaultSteps();
    }

    if (req.body?.sendingAccountIds !== undefined) {
      campaign.sendingAccountIds = await resolveSenderIds(
        req.user.id,
        req.body.sendingAccountIds,
      ) ?? [];
    }

    if (req.body?.timezone !== undefined) {
      campaign.timezone = safeTimeZone(req.body.timezone, campaign.timezone);
    }

    if (req.body?.sendDays !== undefined) {
      campaign.sendDays = sanitizeDays(req.body.sendDays);
    }

    if (req.body?.sendWindowStart !== undefined) {
      campaign.sendWindowStart = sanitizeWindow(
        req.body.sendWindowStart,
        campaign.sendWindowStart,
      );
    }

    if (req.body?.sendWindowEnd !== undefined) {
      campaign.sendWindowEnd = sanitizeWindow(
        req.body.sendWindowEnd,
        campaign.sendWindowEnd,
      );
    }

    if (req.body?.delayBetweenLeadsSeconds !== undefined) {
      campaign.delayBetweenLeadsSeconds = Math.min(
        12 * 60 * 60,
        Math.max(10, Number(req.body.delayBetweenLeadsSeconds) || 120),
      );
    }

    if (req.body?.dailySendingLimit !== undefined) {
      campaign.dailySendingLimit = Math.min(
        500,
        Math.max(1, Number(req.body.dailySendingLimit) || 40),
      );
    }

    if (req.body?.stopOnReply !== undefined) {
      campaign.stopOnReply = Boolean(req.body.stopOnReply);
    }

    if (req.body?.autoEnrollNewLeads !== undefined) {
      campaign.autoEnrollNewLeads = Boolean(req.body.autoEnrollNewLeads);
    }

    await campaign.save();
    await campaign.populate("sendingAccountIds", SENDER_SELECT);

    return res.json({
      campaign: await campaignPayload(campaign),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save campaign";
    return res.status(400).json({ message });
  }
}

export async function launchCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await ownedCampaign(req.user.id, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  if (campaign.status === "active") {
    return res.status(400).json({ message: "Campaign is already running" });
  }

  if (campaign.status === "archived") {
    return res.status(400).json({ message: "Archived campaigns cannot launch" });
  }

  const steps = campaign.steps?.length ? campaign.steps : [];
  if (!isSequenceComplete(steps)) {
    return res.status(400).json({
      message: "Every email in the sequence needs a subject and a message",
    });
  }

  if (!senderObjectIds(campaign).length) {
    return res.status(400).json({ message: "Select at least one mailbox" });
  }

  const leadCount = await CampaignLead.countDocuments({
    campaignId: campaign._id,
  });
  if (!leadCount) {
    return res.status(400).json({ message: "Import at least one lead" });
  }

  try {
    await scheduleEnrollments(campaign, { resetSteps: campaign.status === "draft" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not launch";
    return res.status(400).json({ message });
  }

  campaign.status = "active";
  await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "active" } });

  return res.json({
    campaign: await campaignPayload(campaign),
  });
}

export async function pauseCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await ownedCampaign(req.user.id, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  if (campaign.status !== "active") {
    return res.status(400).json({ message: "Only a running campaign can be paused" });
  }

  campaign.status = "paused";
  await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "paused" } });

  return res.json({
    campaign: await campaignPayload(campaign),
  });
}

export async function resumeCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await ownedCampaign(req.user.id, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  if (campaign.status !== "paused") {
    return res.status(400).json({ message: "Only a paused campaign can resume" });
  }

  if (!isSequenceComplete(campaign.steps)) {
    return res.status(400).json({
      message: "Every email in the sequence needs a subject and a message",
    });
  }

  try {
    const pending = await CampaignLead.find({
      campaignId: campaign._id,
      status: { $in: ["queued", "active"] },
    });

    if (!senderObjectIds(campaign).length) {
      return res.status(400).json({ message: "Select at least one mailbox" });
    }

    const accounts = senderObjectIds(campaign);
    let slot = nextSendSlot(new Date(), campaign);
    let index = 0;
    for (const enrollment of pending) {
      if (!enrollment.sendingAccountId) {
        enrollment.sendingAccountId = accounts[index % accounts.length];
      }
      if (!enrollment.nextSendAt || enrollment.nextSendAt.getTime() < Date.now()) {
        enrollment.nextSendAt = slot;
        slot = nextSendSlot(
          new Date(slot.getTime() + campaign.delayBetweenLeadsSeconds * 1000),
          campaign,
        );
      }
      await enrollment.save();
      index += 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not resume";
    return res.status(400).json({ message });
  }

  campaign.status = "active";
  await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "active" } });

  return res.json({
    campaign: await campaignPayload(campaign),
  });
}

export async function sendNowCampaign(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await ownedCampaign(req.user.id, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  if (campaign.status !== "active") {
    return res.status(400).json({ message: "Launch the campaign before sending" });
  }

  const limit = Math.min(8, Math.max(1, Number(req.body?.limit) || 1));
  const results = await processCampaignNow(campaign._id, limit);
  const sent = results.filter((row) => row.status === "sent").length;
  const failed = results.filter((row) => row.status === "failed").length;
  const held = results.filter((row) => row.status === "held").length;
  const skipped = results.filter((row) => row.status === "skipped").length;

  const recentSends = await EmailMessage.find({ campaignId: campaign._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("leadId", "email firstName lastName fullName");

  return res.json({
    sent,
    failed,
    held,
    skipped,
    results,
    campaign: await campaignPayload(campaign, { recentSends }),
  });
}
