import type { Billing } from "./cost";

export type IsoDate = string;
const DAY = 86_400_000;

function parse(d: IsoDate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) {
    const [y, mo, da] = [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
    const t = new Date(Date.UTC(y, mo - 1, da));
    if (t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === da) {
      return [y, mo, da];
    }
  }
  throw new RangeError(`Bad date: ${d}`);
}

export function isIsoDate(d: string): boolean {
  try {
    parse(d);
    return true;
  } catch {
    return false;
  }
}

const fmt = (t: number): IsoDate => new Date(t).toISOString().slice(0, 10);

function ms(d: IsoDate): number {
  const [y, m, da] = parse(d);
  return Date.UTC(y, m - 1, da);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fmt(ms(d) + n * DAY);
}

export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((ms(b) - ms(a)) / DAY);
}

export function addMonthsClamped(d: IsoDate, months: number): IsoDate {
  const [y, m, da] = parse(d);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fmt(Date.UTC(ny, nm, Math.min(da, last)));
}

export function nextRenewal(anchor: IsoDate, b: Billing, today: IsoDate): IsoDate {
  const [ay, am] = parse(anchor);
  const [ty, tm] = parse(today);
  if (!Number.isInteger(b.interval) || b.interval < 1) {
    throw new RangeError(`Bad interval: ${b.interval}`);
  }
  if (anchor >= today) return anchor;
  if (b.cycle === "weekly" || b.cycle === "custom") {
    const step = (b.cycle === "weekly" ? 7 : 1) * b.interval;
    return addDays(anchor, Math.ceil(daysBetween(anchor, today) / step) * step);
  }
  const step = { monthly: 1, quarterly: 3, yearly: 12 }[b.cycle] * b.interval;
  const k = Math.floor(((ty - ay) * 12 + (tm - am)) / step);
  // Month index of step k+1 is past today's month, so k or k+1 always works.
  const c = addMonthsClamped(anchor, k * step);
  return c >= today ? c : addMonthsClamped(anchor, (k + 1) * step);
}

export function defaultStopDate(renewal: IsoDate, daysBefore = 3): IsoDate {
  return addDays(renewal, -daysBefore);
}
