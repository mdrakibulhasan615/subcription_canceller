import { isIsoDate } from "./dates";

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Offset of tz from UTC in ms at the given instant.
function offsetAt(tz: string, t: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(t));
  const g = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return local - Math.floor(t / 1000) * 1000;
}

export function localToUtc(date: string, hour: number, minute: number, tz: string): Date {
  if (!isValidTimezone(tz)) throw new RangeError(`Bad timezone: ${tz}`);
  const timeOk =
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour < 24 &&
    minute >= 0 &&
    minute < 60;
  if (!isIsoDate(date) || !timeOk)
    throw new RangeError(`Bad local time: ${date} ${hour}:${minute}`);
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, mo - 1, d, hour, minute);
  const before = offsetAt(tz, guess - 86_400_000);
  const after = offsetAt(tz, guess + 86_400_000);
  const valid = [before, after]
    .map((o) => guess - o)
    .filter((t) => offsetAt(tz, t) === guess - t)
    .sort((a, b) => a - b);
  // No valid instant means a gap: use the offset from before the gap.
  return new Date(valid[0] ?? guess - before);
}
