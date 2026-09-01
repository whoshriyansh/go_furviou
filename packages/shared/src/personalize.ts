import { LEAD_FIELDS, type LeadFieldKey } from "./leadFields";

const KEY_BY_ALIAS: Record<string, LeadFieldKey> = {};

for (const field of LEAD_FIELDS) {
  KEY_BY_ALIAS[field.key.toLowerCase()] = field.key;
  KEY_BY_ALIAS[field.label.toLowerCase()] = field.key;
}

const EXTRA: Record<string, LeadFieldKey> = {
  firstname: "firstName",
  "first name": "firstName",
  lastname: "lastName",
  "last name": "lastName",
  fullname: "fullName",
  "full name": "fullName",
  companyname: "company",
  "company name": "company",
  jobtitle: "jobTitle",
  "job title": "jobTitle",
  icebreaker: "iceBreaker",
  phonenumber: "mobile",
  phone: "mobile",
};

function resolveField(raw: string): LeadFieldKey | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const afterContact = trimmed.replace(/^contact\s*>\s*/i, "");
  const normalized = afterContact.toLowerCase().replace(/[_-]+/g, " ").trim();
  const compact = normalized.replace(/\s+/g, "");

  return (
    KEY_BY_ALIAS[normalized] ||
    KEY_BY_ALIAS[compact] ||
    EXTRA[normalized] ||
    EXTRA[compact] ||
    null
  );
}

export function personalizeTemplate(
  template: string,
  values: Partial<Record<LeadFieldKey, string | undefined>>,
) {
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, raw: string) => {
    const key = resolveField(raw);
    if (!key) {
      return "";
    }
    return String(values[key] ?? "").trim();
  });
}

export function leadToPersonalizeValues(
  lead: Partial<Record<LeadFieldKey, string | undefined>>,
) {
  const values: Partial<Record<LeadFieldKey, string>> = {};
  for (const field of LEAD_FIELDS) {
    const value = lead[field.key];
    if (value) {
      values[field.key] = String(value);
    }
  }
  return values;
}
