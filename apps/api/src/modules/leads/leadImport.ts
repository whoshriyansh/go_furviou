import { Types } from "mongoose";
import { LEAD_FIELDS, enrichLeadValues, type LeadFieldKey } from "@furviou/shared";
import CampaignLead from "../../models/campaignLead";
import Lead from "../../models/lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELD_KEYS = new Set(LEAD_FIELDS.map((field) => field.key));
const FILL_KEYS = LEAD_FIELDS.map((field) => field.key).filter(
  (key) => key !== "email",
);

export type Mapping = Record<string, LeadFieldKey | "skip">;

export type LeadImportResult = {
  imported: number;
  updated: number;
  enrolled: number;
  alreadyEnrolled: number;
  skippedNoEmail: number;
  skippedInvalid: number;
};

type LeadPayload = Partial<Record<LeadFieldKey, string>> & { email: string };

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

function mappedFields(incoming: LeadPayload) {
  const enriched = enrichLeadValues(incoming);
  const set: Record<string, string> = {};
  for (const key of FILL_KEYS) {
    const next = enriched[key] || incoming[key];
    if (next) {
      set[key] = next;
    }
  }
  return set;
}

export function parseCsvLeads(mapping: Mapping, rows: Record<string, string>[]) {
  const byEmail = new Map<string, LeadPayload>();
  let skippedNoEmail = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
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
    byEmail.set(email, { ...data, email });
  }

  return {
    payloads: [...byEmail.values()],
    skippedNoEmail,
    skippedInvalid,
  };
}

/**
 * One Lead per owner+email. Re-import never creates a second contact.
 * Mapped CSV columns are written onto that contact (names are split into
 * first/last/full) and the campaign is linked by campaignIds.
 */
export async function upsertLeadsOnce(input: {
  ownerId: Types.ObjectId;
  mapping: Mapping;
  rows: Record<string, string>[];
  campaignId?: Types.ObjectId;
}): Promise<LeadImportResult> {
  const parsed = parseCsvLeads(input.mapping, input.rows);
  const empty: LeadImportResult = {
    imported: 0,
    updated: 0,
    enrolled: 0,
    alreadyEnrolled: 0,
    skippedNoEmail: parsed.skippedNoEmail,
    skippedInvalid: parsed.skippedInvalid,
  };

  if (!parsed.payloads.length) {
    return empty;
  }

  const emails = parsed.payloads.map((row) => row.email);
  const existing = await Lead.find({
    createdBy: input.ownerId,
    email: { $in: emails },
  });
  const existingByEmail = new Map(
    existing.map((lead) => [lead.email, lead] as const),
  );

  const toInsert: Record<string, unknown>[] = [];
  const updateOps: Array<{
    updateOne: {
      filter: { _id: Types.ObjectId };
      update: Record<string, unknown>;
    };
  }> = [];

  let imported = 0;
  let updated = 0;

  for (const payload of parsed.payloads) {
    const found = existingByEmail.get(payload.email);
    if (!found) {
      toInsert.push({
        ...mappedFields(payload),
        email: payload.email,
        createdBy: input.ownerId,
        source: "csv",
        campaignIds: input.campaignId ? [input.campaignId] : [],
      });
      imported += 1;
      continue;
    }

    updated += 1;
    const set = mappedFields(payload);
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) {
      update.$set = set;
    }
    if (input.campaignId) {
      update.$addToSet = { campaignIds: input.campaignId };
    }
    if (Object.keys(update).length) {
      updateOps.push({
        updateOne: { filter: { _id: found._id }, update },
      });
    }
  }

  if (toInsert.length) {
    await Lead.insertMany(toInsert, { ordered: false });
  }

  const CHUNK = 200;
  for (let i = 0; i < updateOps.length; i += CHUNK) {
    await Lead.bulkWrite(updateOps.slice(i, i + CHUNK), { ordered: false });
  }

  const leads = await Lead.find({
    createdBy: input.ownerId,
    email: { $in: emails },
  }).select("_id");

  if (!input.campaignId) {
    return {
      ...empty,
      imported,
      updated,
    };
  }

  const existingLinks = await CampaignLead.find({
    campaignId: input.campaignId,
    leadId: { $in: leads.map((lead) => lead._id) },
  }).select("leadId");
  const already = new Set(existingLinks.map((link) => String(link.leadId)));

  const enrollOps = leads.map((lead) => ({
    updateOne: {
      filter: { campaignId: input.campaignId, leadId: lead._id },
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

  await Lead.updateMany(
    { _id: { $in: leads.map((lead) => lead._id) } },
    { $addToSet: { campaignIds: input.campaignId } },
  );

  return {
    ...empty,
    imported,
    updated,
    enrolled: leads.filter((lead) => !already.has(String(lead._id))).length,
    alreadyEnrolled: already.size,
  };
}
