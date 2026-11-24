import { monthlyMinor, yearlyMinor, type Billing, type BillingCycle } from "./cost";
import { daysBetween, type IsoDate } from "./dates";
import { CURRENCIES, type Currency } from "./money";
import { deriveStatus, type SubStatus } from "./status";

export type DashSub = {
  id: string;
  name: string;
  category: string | null;
  price_minor: number;
  currency: Currency;
  billing_cycle: string;
  billing_interval: number;
  next_renewal_date: string | null;
  stop_date: string | null;
  stop_confirmed_at: string | null;
  merchant_cancelled_at: string | null;
  archived_at: string | null;
};
export type PerCurrency = Partial<Record<Currency, number>>;
export type UpcomingEvent = {
  subId: string;
  name: string;
  kind: "stop" | "renewal";
  date: IsoDate;
  daysLeft: number;
  status: SubStatus;
};
export type CategoryRow = { category: string; monthlyMinor: number; percent: number };

const statusOf = (s: DashSub, today: IsoDate) =>
  deriveStatus(
    {
      stopDate: s.stop_date,
      merchantCancelledAt: s.merchant_cancelled_at,
      stopConfirmedAt: s.stop_confirmed_at,
    },
    today,
  );

const billing = (s: DashSub): Billing => ({
  cycle: s.billing_cycle as BillingCycle,
  interval: s.billing_interval,
});

const add = (m: PerCurrency, c: Currency, n: number) => {
  m[c] = (m[c] ?? 0) + n;
};

/** Non-archived subs that are active or stopping soon. */
export function countedSubs<T extends DashSub>(subs: T[], today: IsoDate): T[] {
  return subs.filter((s) => {
    if (s.archived_at) return false;
    const st = statusOf(s, today);
    return st === "active" || st === "stopping_soon";
  });
}

export function totals(subs: DashSub[], today: IsoDate) {
  const monthly: PerCurrency = {};
  const yearly: PerCurrency = {};
  let skipped = 0;
  for (const s of countedSubs(subs, today)) {
    try {
      const m = monthlyMinor(s.price_minor, billing(s));
      const y = yearlyMinor(s.price_minor, billing(s));
      add(monthly, s.currency, m);
      add(yearly, s.currency, y);
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      skipped += 1;
    }
  }
  return { monthly, yearly, skipped };
}

export function upcoming(subs: DashSub[], today: IsoDate, limit = 5): UpcomingEvent[] {
  const events: UpcomingEvent[] = [];
  for (const s of countedSubs(subs, today)) {
    const status = statusOf(s, today);
    const base = { subId: s.id, name: s.name, status };
    if (s.stop_date) {
      events.push({
        ...base,
        kind: "stop",
        date: s.stop_date,
        daysLeft: daysBetween(today, s.stop_date),
      });
    }
    if (s.next_renewal_date && s.next_renewal_date >= today) {
      events.push({
        ...base,
        kind: "renewal",
        date: s.next_renewal_date,
        daysLeft: daysBetween(today, s.next_renewal_date),
      });
    }
  }
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return events
    .sort(
      (a, b) =>
        cmp(a.date, b.date) ||
        (a.kind === b.kind ? 0 : a.kind === "stop" ? -1 : 1) ||
        cmp(a.name, b.name) ||
        cmp(a.subId, b.subId),
    )
    .slice(0, limit);
}

/** Yearly cost of stopped or cancelled subs, archived ones too. An estimate only. */
export function savings(subs: DashSub[], today: IsoDate) {
  const yearly: PerCurrency = {};
  const monthly: PerCurrency = {};
  let count = 0;
  for (const s of subs) {
    const st = statusOf(s, today);
    if (st !== "stopped" && st !== "cancelled") continue;
    try {
      const y = yearlyMinor(s.price_minor, billing(s));
      const m = monthlyMinor(s.price_minor, billing(s));
      add(yearly, s.currency, y);
      add(monthly, s.currency, m);
      count += 1;
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
    }
  }
  return { yearly, monthly, count };
}

export function categoryBreakdown(
  subs: DashSub[],
  today: IsoDate,
): Partial<Record<Currency, CategoryRow[]>> {
  const sums = new Map<Currency, Map<string, number>>();
  for (const s of countedSubs(subs, today)) {
    let m: number;
    try {
      m = monthlyMinor(s.price_minor, billing(s));
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      continue;
    }
    const cur = sums.get(s.currency) ?? new Map<string, number>();
    const key = s.category?.trim() || "Uncategorised";
    cur.set(key, (cur.get(key) ?? 0) + m);
    sums.set(s.currency, cur);
  }
  const out: Partial<Record<Currency, CategoryRow[]>> = {};
  for (const c of CURRENCIES) {
    const cur = sums.get(c);
    if (!cur) continue;
    const total = [...cur.values()].reduce((a, b) => a + b, 0);
    out[c] = [...cur]
      .map(([category, monthlyMinor]) => ({
        category,
        monthlyMinor,
        percent: total > 0 ? Math.round((monthlyMinor / total) * 100) : 0,
      }))
      .sort((a, b) => b.monthlyMinor - a.monthlyMinor || a.category.localeCompare(b.category));
  }
  return out;
}
