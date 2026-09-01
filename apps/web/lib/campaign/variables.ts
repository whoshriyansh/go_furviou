import { LEAD_FIELDS, type LeadFieldKey } from "@furviou/shared";

export function openVariableQuery(text: string, cursor: number) {
  const before = text.slice(0, cursor);
  const start = before.lastIndexOf("{{");
  if (start < 0) {
    return null;
  }
  const inner = before.slice(start + 2);
  if (inner.includes("}}") || /[\n\r]/.test(inner)) {
    return null;
  }
  return { start, query: inner };
}

export function matchingLeadFields(query: string) {
  const needle = query.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!needle) {
    return LEAD_FIELDS;
  }
  return LEAD_FIELDS.filter((field) => {
    const key = field.key.toLowerCase();
    const label = field.label.toLowerCase().replace(/[\s_-]+/g, "");
    return (
      key.includes(needle) ||
      label.includes(needle) ||
      field.label.toLowerCase().includes(query.trim().toLowerCase())
    );
  });
}

export function applyVariableToken(
  text: string,
  cursor: number,
  key: LeadFieldKey,
) {
  const open = openVariableQuery(text, cursor);
  if (!open) {
    const token = `{{${key}}}`;
    const next = `${text.slice(0, cursor)}${token}${text.slice(cursor)}`;
    return { next, cursor: cursor + token.length };
  }
  const token = `{{${key}}}`;
  const next = `${text.slice(0, open.start)}${token}${text.slice(cursor)}`;
  return { next, cursor: open.start + token.length };
}
