import type { Request, Response } from "express";
import { Types } from "mongoose";
import Campaign, { type DayOfWeek } from "../../models/campaign";
import CampaignLead from "../../models/campaignLead";
import Lead from "../../models/lead";
import { escapeRegex } from "../../utils/escapeRegex";
import { nextSendSlot } from "../campaigns/schedule";
import { syncEnrollmentJobs } from "../../queue/sendQueue";
import {
  upsertLeadsOnce,
  type Mapping,
} from "./leadImport";

async function ownedCampaign(userId: string, campaignId: string) {
  return Campaign.findOne({ _id: campaignId, createdBy: userId });
}

function senderObjectIds(campaign: { sendingAccountIds: Types.ObjectId[] }) {
  return campaign.sendingAccountIds || [];
}

async function scheduleActiveEnrollments(
  campaign: {
    _id: Types.ObjectId;
    status: string;
    autoEnrollNewLeads: boolean;
    sendingAccountIds: Types.ObjectId[];
    timezone: string;
    sendDays: DayOfWeek[];
    sendWindowStart: string;
    sendWindowEnd: string;
    delayBetweenLeadsSeconds: number;
  },
  leadIds: Types.ObjectId[],
) {
  const accounts = senderObjectIds(campaign);
  if (
    campaign.status !== "active" ||
    !campaign.autoEnrollNewLeads ||
    !accounts.length
  ) {
    return;
  }

  const pending = await CampaignLead.find({
    campaignId: campaign._id,
    leadId: { $in: leadIds },
    status: "queued",
    $or: [{ nextSendAt: { $exists: false } }, { nextSendAt: null }],
  });

  let slot = nextSendSlot(new Date(), campaign);
  let index = 0;
  for (const enrollment of pending) {
    enrollment.sendingAccountId = accounts[index % accounts.length];
    enrollment.nextSendAt = slot;
    await enrollment.save();
    index += 1;
    slot = nextSendSlot(
      new Date(slot.getTime() + campaign.delayBetweenLeadsSeconds * 1000),
      campaign,
    );
  }

  await syncEnrollmentJobs(pending);
}

export async function importLeads(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const mapping = (req.body?.mapping || {}) as Mapping;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!rows.length) {
    return res.status(400).json({ message: "No CSV rows to import" });
  }
  if (!Object.values(mapping).includes("email")) {
    return res.status(400).json({ message: "Map a column to Email" });
  }

  const result = await upsertLeadsOnce({
    ownerId: new Types.ObjectId(req.user.id),
    mapping,
    rows,
  });

  return res.json(result);
}

export async function importCampaignLeads(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const userId = req.user.id;
  const campaign = await ownedCampaign(userId, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  const mapping = (req.body?.mapping || {}) as Mapping;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!rows.length) {
    return res.status(400).json({ message: "No CSV rows to import" });
  }
  if (!Object.values(mapping).includes("email")) {
    return res.status(400).json({ message: "Map a column to Email" });
  }

  const result = await upsertLeadsOnce({
    ownerId: new Types.ObjectId(userId),
    mapping,
    rows,
    campaignId: campaign._id,
  });

  const leads = await Lead.find({
    createdBy: userId,
    campaignIds: campaign._id,
  }).select("_id");

  await scheduleActiveEnrollments(campaign, leads.map((lead) => lead._id));

  return res.json(result);
}

export async function listCampaignLeads(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const campaign = await ownedCampaign(req.user.id, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const q = String(req.query.q || "").trim();

  const filter: Record<string, unknown> = { campaignId: campaign._id };

  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    const matches = await Lead.find({
      createdBy: req.user.id,
      $or: [
        { email: re },
        { firstName: re },
        { lastName: re },
        { fullName: re },
        { mobile: re },
        { company: re },
        { city: re },
        { country: re },
      ],
    }).select("_id");
    filter.leadId = { $in: matches.map((lead) => lead._id) };
  }

  const total = await CampaignLead.countDocuments(filter);
  const links = await CampaignLead.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("leadId");

  return res.json({
    total,
    page,
    limit,
    leads: links
      .map((link) => {
        const lead = link.leadId as unknown as {
          toObject?: () => Record<string, unknown>;
        } | null;
        if (!lead?.toObject) {
          return null;
        }
        return {
          ...lead.toObject(),
          enrollmentId: String(link._id),
          enrollmentStatus: link.status,
          currentStep: link.currentStep,
          nextSendAt: link.nextSendAt,
          lastSentAt: link.lastSentAt,
          lastError: link.lastError,
        };
      })
      .filter(Boolean),
  });
}

export async function listAllLeads(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const q = String(req.query.q || "").trim();

  const filter: Record<string, unknown> = { createdBy: req.user.id };
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [
      { email: re },
      { firstName: re },
      { lastName: re },
      { fullName: re },
      { mobile: re },
      { company: re },
      { city: re },
      { country: re },
    ];
  }

  const total = await Lead.countDocuments(filter);
  const leads = await Lead.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const links = await CampaignLead.find({
    leadId: { $in: leads.map((lead) => lead._id) },
  }).populate("campaignId", "name");

  const campaignsByLead = new Map<string, { id: string; name: string }[]>();
  for (const link of links) {
    const campaign = link.campaignId as unknown as {
      _id: { toString(): string };
      name: string;
    } | null;
    if (!campaign?.name) {
      continue;
    }
    const leadId = String(link.leadId);
    const list = campaignsByLead.get(leadId) ?? [];
    list.push({ id: String(campaign._id), name: campaign.name });
    campaignsByLead.set(leadId, list);
  }

  return res.json({
    total,
    page,
    limit,
    leads: leads.map((lead) => ({
      ...lead.toObject(),
      campaignIds: (lead.campaignIds || []).map((id) => String(id)),
      campaigns: campaignsByLead.get(String(lead._id)) ?? [],
    })),
  });
}
