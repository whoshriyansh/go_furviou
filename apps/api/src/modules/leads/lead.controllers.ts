import type { Request, Response } from "express";
import { Types } from "mongoose";
import { LEAD_FIELDS, type LeadFieldKey } from "@furviou/shared";
import Campaign, { type DayOfWeek } from "../../models/campaign";
import CampaignLead from "../../models/campaignLead";
import Lead from "../../models/lead";
import { escapeRegex } from "../../utils/escapeRegex";
import { nextSendSlot } from "../campaigns/schedule";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_KEYS = new Set(LEAD_FIELDS.map((field) => field.key));

type Mapping = Record<string, LeadFieldKey | "skip">;

function applyMapping(row: Record<string, string>, mapping: Mapping) {
  const data: Partial<Record<LeadFieldKey, string>> = {};

  for (const [csvColumn, field] of Object.entries(mapping)) {
    if (!field || field === "skip" || !FIELD_KEYS.has(field)) {
      continue;
    }
    const value = String(row[csvColumn] ?? "").trim();
    if (value) {
      data[field] = value;
    }
  }

  return data;
}

async function ownedCampaign(userId: string, campaignId: string) {
  return Campaign.findOne({ _id: campaignId, createdBy: userId });
}

function senderObjectIds(campaign: { sendingAccountIds: Types.ObjectId[] }) {
  return campaign.sendingAccountIds || [];
}

export async function importCampaignLeads(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authorized" });
  }

  const userId = req.user.id;
  const ownerId = new Types.ObjectId(userId);
  const campaign = await ownedCampaign(userId, String(req.params.id));
  if (!campaign) {
    return res.status(404).json({ message: "Campaign not found" });
  }

  const mapping = (req.body?.mapping || {}) as Mapping;
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (!rows.length) {
    return res.status(400).json({ message: "No CSV rows to import" });
  }

  const mappedEmail = Object.values(mapping).includes("email");
  if (!mappedEmail) {
    return res.status(400).json({ message: "Map a column to Email" });
  }

  const byEmail = new Map<string, Partial<Record<LeadFieldKey, string>> & { email: string }>();
  let skippedNoEmail = 0;
  let skippedInvalid = 0;

  for (const row of rows as Record<string, string>[]) {
    const data = applyMapping(row, mapping);
    const email = data.email?.toLowerCase();

    if (!email) {
      skippedNoEmail += 1;
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      skippedInvalid += 1;
      continue;
    }

    byEmail.set(email, { ...data, email, source: "csv" } as never);
  }

  const payloads = [...byEmail.values()];
  if (!payloads.length) {
    return res.json({
      imported: 0,
      updated: 0,
      skippedNoEmail,
      skippedInvalid,
    });
  }

  const emails = payloads.map((row) => row.email);
  const existing = await Lead.find({
    createdBy: ownerId,
    email: { $in: emails },
  }).select("email");
  const existingEmails = new Set(existing.map((lead) => lead.email));

  const ops = payloads.map((payload) => ({
    updateOne: {
      filter: { createdBy: ownerId, email: payload.email },
      update: {
        $set: { ...payload, createdBy: ownerId, source: "csv" as const },
      },
      upsert: true,
    },
  }));

  const CHUNK = 200;
  for (let i = 0; i < ops.length; i += CHUNK) {
    await Lead.bulkWrite(ops.slice(i, i + CHUNK) as never, { ordered: false });
  }

  const leads = await Lead.find({
    createdBy: ownerId,
    email: { $in: emails },
  }).select("_id email");

  const enrollOps = leads.map((lead) => ({
    updateOne: {
      filter: { campaignId: campaign._id, leadId: lead._id },
      update: {
        $setOnInsert: { status: "queued" as const, currentStep: 0 },
      },
      upsert: true,
    },
  }));

  for (let i = 0; i < enrollOps.length; i += CHUNK) {
    await CampaignLead.bulkWrite(enrollOps.slice(i, i + CHUNK) as never, {
      ordered: false,
    });
  }

  const accounts = senderObjectIds(campaign);
  if (
    campaign.status === "active" &&
    campaign.autoEnrollNewLeads &&
    accounts.length
  ) {
    const pending = await CampaignLead.find({
      campaignId: campaign._id,
      leadId: { $in: leads.map((lead) => lead._id) },
      status: "queued",
      $or: [{ nextSendAt: { $exists: false } }, { nextSendAt: null }],
    });

    let slot = nextSendSlot(new Date(), {
      timezone: campaign.timezone,
      sendDays: campaign.sendDays as DayOfWeek[],
      sendWindowStart: campaign.sendWindowStart,
      sendWindowEnd: campaign.sendWindowEnd,
    });

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
  }

  return res.json({
    imported: payloads.filter((row) => !existingEmails.has(row.email)).length,
    updated: payloads.filter((row) => existingEmails.has(row.email)).length,
    skippedNoEmail,
    skippedInvalid,
  });
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
      campaigns: campaignsByLead.get(String(lead._id)) ?? [],
    })),
  });
}
