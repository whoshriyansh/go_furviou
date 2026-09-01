export const COMMON_TIMEZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Phoenix",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Calcutta",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Pacific/Auckland",
];

const PRIORITY = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "UTC",
  "Asia/Kolkata",
  "Asia/Calcutta",
];

export function listTimeZones() {
  const all = new Set(COMMON_TIMEZONES);
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  try {
    for (const zone of intl.supportedValuesOf?.("timeZone") || []) {
      all.add(zone);
    }
  } catch {
    // ignore
  }
  all.add("Asia/Calcutta");
  all.add("Asia/Kolkata");

  const rest = [...all]
    .filter((zone) => !PRIORITY.includes(zone))
    .sort((a, b) => a.localeCompare(b));
  return [...PRIORITY.filter((zone) => all.has(zone)), ...rest];
}

export function safeTimeZone(timeZone: string | undefined, fallback = "UTC") {
  const value = String(timeZone || "").trim() || fallback;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return fallback;
  }
}
