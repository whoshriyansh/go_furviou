import { safeTimeZone } from "@furviou/shared";
import type { DayOfWeek } from "../../models/campaign";

const WEEKDAYS: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export type Schedule = {
  timezone: string;
  sendDays: DayOfWeek[];
  sendWindowStart: string;
  sendWindowEnd: string;
};

type ZonedParts = {
  timeZone: string;
  weekday: DayOfWeek;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partNumber(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return Number(parts.find((part) => part.type === type)?.value || 0);
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const tz = safeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const weekdayName = (
    parts.find((part) => part.type === "weekday")?.value || "monday"
  ).toLowerCase();

  return {
    timeZone: tz,
    weekday: (WEEKDAYS.includes(weekdayName as DayOfWeek)
      ? weekdayName
      : "monday") as DayOfWeek,
    year: partNumber(parts, "year"),
    month: partNumber(parts, "month"),
    day: partNumber(parts, "day"),
    hour: partNumber(parts, "hour"),
    minute: partNumber(parts, "minute"),
    second: partNumber(parts, "second"),
  };
}

export function parseHm(value: string) {
  const [hourRaw, minuteRaw] = String(value || "09:00").split(":");
  const hour = Math.min(23, Math.max(0, Number(hourRaw) || 0));
  const minute = Math.min(59, Math.max(0, Number(minuteRaw) || 0));
  return { hour, minute };
}

function minutesOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

export function zonedLocalToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
) {
  const tz = safeTimeZone(timeZone);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  let instant = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const parts = format.formatToParts(new Date(instant));
    const got = Date.UTC(
      partNumber(parts, "year"),
      partNumber(parts, "month") - 1,
      partNumber(parts, "day"),
      partNumber(parts, "hour"),
      partNumber(parts, "minute"),
      partNumber(parts, "second"),
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    instant += wanted - got;
  }

  return new Date(instant);
}

export function startOfZonedDay(date: Date, timeZone: string) {
  const zoned = getZonedParts(date, timeZone);
  return zonedLocalToUtc(zoned.timeZone, zoned.year, zoned.month, zoned.day, 0, 0);
}

export function zonedDateKey(date: Date, timeZone: string) {
  const zoned = getZonedParts(date, timeZone);
  return `${zoned.year}-${String(zoned.month).padStart(2, "0")}-${String(zoned.day).padStart(2, "0")}`;
}

export function isWithinSendWindow(date: Date, schedule: Schedule) {
  const zoned = getZonedParts(date, schedule.timezone);
  if (!schedule.sendDays.includes(zoned.weekday)) {
    return false;
  }

  const nowM = minutesOfDay(zoned.hour, zoned.minute);
  const start = parseHm(schedule.sendWindowStart);
  const end = parseHm(schedule.sendWindowEnd);
  const startM = minutesOfDay(start.hour, start.minute);
  const endM = minutesOfDay(end.hour, end.minute);

  if (endM <= startM) {
    return nowM >= startM || nowM < endM;
  }

  return nowM >= startM && nowM < endM;
}

function addCalendarDays(year: number, month: number, day: number, amount: number) {
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function nextSendSlot(from: Date, schedule: Schedule) {
  if (isWithinSendWindow(from, schedule)) {
    return from;
  }

  const tz = safeTimeZone(schedule.timezone);
  const zoned = getZonedParts(from, tz);
  const start = parseHm(schedule.sendWindowStart);
  const days = schedule.sendDays.length
    ? schedule.sendDays
    : (["monday", "tuesday", "wednesday", "thursday", "friday"] as DayOfWeek[]);

  const todayStart = zonedLocalToUtc(
    tz,
    zoned.year,
    zoned.month,
    zoned.day,
    start.hour,
    start.minute,
  );

  if (from.getTime() < todayStart.getTime() && days.includes(zoned.weekday)) {
    return todayStart;
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    const calendar = addCalendarDays(zoned.year, zoned.month, zoned.day, offset);
    const noon = zonedLocalToUtc(
      tz,
      calendar.year,
      calendar.month,
      calendar.day,
      12,
      0,
    );
    const weekday = getZonedParts(noon, tz).weekday;
    if (days.includes(weekday)) {
      return zonedLocalToUtc(
        tz,
        calendar.year,
        calendar.month,
        calendar.day,
        start.hour,
        start.minute,
      );
    }
  }

  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

export function formatInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export function delayMs(value: number, unit: "minutes" | "hours" | "days") {
  const amount = Math.max(0, Number(value) || 0);
  if (unit === "minutes") {
    return amount * 60 * 1000;
  }
  if (unit === "hours") {
    return amount * 60 * 60 * 1000;
  }
  return amount * 24 * 60 * 60 * 1000;
}

export function addDelayThenSlot(
  from: Date,
  schedule: Schedule,
  value: number,
  unit: "minutes" | "hours" | "days",
) {
  return nextSendSlot(new Date(from.getTime() + delayMs(value, unit)), schedule);
}
