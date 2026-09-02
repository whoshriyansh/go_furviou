import { LEAD_FIELDS, type LeadFieldKey } from "./leadFields";

const KEY_BY_ALIAS: Record<string, LeadFieldKey> = {};

for (const field of LEAD_FIELDS) {
  KEY_BY_ALIAS[field.key.toLowerCase()] = field.key;
  KEY_BY_ALIAS[field.label.toLowerCase()] = field.key;
}

const EXTRA: Record<string, LeadFieldKey> = {
  name: "fullName",
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
  ice: "iceBreaker",
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

export function splitFullName(fullName: string) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0] || "", lastName: "" };
  }
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function readValue(
  lead: Partial<Record<LeadFieldKey, string | undefined>> | Record<string, unknown>,
  key: LeadFieldKey,
) {
  const value = (lead as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

/** Fill first/last/full from whatever name fields were mapped. */
export function enrichLeadValues(
  lead: Partial<Record<LeadFieldKey, string | undefined>> | Record<string, unknown>,
) {
  const values: Partial<Record<LeadFieldKey, string>> = {};
  for (const field of LEAD_FIELDS) {
    const value = readValue(lead, field.key);
    if (value) {
      values[field.key] = value;
    }
  }

  if (!values.fullName) {
    const joined = [values.firstName, values.lastName].filter(Boolean).join(" ");
    if (joined) {
      values.fullName = joined;
    }
  }

  if (values.fullName && (!values.firstName || !values.lastName)) {
    const split = splitFullName(values.fullName);
    if (!values.firstName && split.firstName) {
      values.firstName = split.firstName;
    }
    if (!values.lastName && split.lastName) {
      values.lastName = split.lastName;
    }
  }

  return values;
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
  lead: Partial<Record<LeadFieldKey, string | undefined>> | Record<string, unknown>,
) {
  return enrichLeadValues(lead);
}
