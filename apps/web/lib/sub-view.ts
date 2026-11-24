import {
  daysBetween,
  deriveStatus,
  formatMoney,
  matchGuideSlug,
  monthlyMinor,
  type BillingCycle,
  type Guide,
  type GuideKind,
  type SubStatus,
} from "@app/core";
import { CYCLE_LABELS } from "../app/app/subscriptions/form-utils";
import { loadGuide } from "./guides";
import { isUuid, todayIn, type HistoryRow, type SubDb, type SubFull } from "./subscriptions";

type Sp = Record<string, string | string[] | undefined>;
export const STATUSES: SubStatus[] = ["active", "stopping_soon", "stopped", "cancelled"];
export interface ListParams {
  status: SubStatus | null;
  sort: "next" | "name";
  archived: boolean;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseListParams(sp: Sp): ListParams {
  const status = first(sp.status);
  return {
    status: STATUSES.find((s) => s === status) ?? null,
    sort: first(sp.sort) === "name" ? "name" : "next",
    archived: first(sp.archived) === "1",
  };
}

export interface SubRowView {
  id: string;
  name: string;
  priceText: string;
  cycleText: string;
  monthlyText: string;
  nextRenewal: string | null;
  stopDate: string | null;
  daysLeft: number | null;
  nextEvent: string | null;
  status: SubStatus;
  archived: boolean;
}

/** Soonest of stop date and renewal that is today or later. Both past: the stop date. */
export function nextEventDate(
  stop: string | null,
  renewal: string | null,
  today: string,
): string | null {
  const future = [stop, renewal].filter((d): d is string => !!d && d >= today).sort();
  return future[0] ?? stop ?? renewal;
}

export function toRow(sub: SubFull, today: string): SubRowView {
  const { currency } = sub;
  let monthlyText = "Not available";
  try {
    const m = monthlyMinor(sub.price_minor, {
      cycle: sub.billing_cycle as BillingCycle,
      interval: sub.billing_interval,
    });
    monthlyText = `${formatMoney(m, currency)} / month`;
  } catch {
    // Bad stored interval: show "Not available", do not crash the list.
  }
  const target = sub.stop_date ?? sub.next_renewal_date;
  return {
    id: sub.id,
    name: sub.name,
    priceText: formatMoney(sub.price_minor, currency),
    cycleText:
      sub.billing_cycle === "custom"
        ? `Every ${sub.billing_interval} days`
        : (CYCLE_LABELS[sub.billing_cycle as keyof typeof CYCLE_LABELS] ?? sub.billing_cycle),
    monthlyText,
    nextRenewal: sub.next_renewal_date,
    stopDate: sub.stop_date,
    daysLeft: target ? daysBetween(today, target) : null,
    nextEvent: nextEventDate(sub.stop_date, sub.next_renewal_date, today),
    status: deriveStatus(
      {
        stopDate: sub.stop_date,
        merchantCancelledAt: sub.merchant_cancelled_at,
        stopConfirmedAt: sub.stop_confirmed_at,
      },
      today,
    ),
    archived: !!sub.archived_at,
  };
}

export const daysLeftText = (n: number | null) =>
  n === null ? "Not set" : n < 0 ? "Stop date passed" : n === 1 ? "1 day" : `${n} days`;

export function filterSort(rows: SubRowView[], p: ListParams): SubRowView[] {
  const out = rows.filter(
    (r) => (p.archived || !r.archived) && (!p.status || r.status === p.status),
  );
  return out.sort((a, b) => {
    if (p.sort === "next") {
      if (a.nextEvent !== b.nextEvent) {
        if (!a.nextEvent) return 1;
        if (!b.nextEvent) return -1;
        return a.nextEvent < b.nextEvent ? -1 : 1;
      }
    }
    return a.name.localeCompare(b.name);
  });
}

/** Only https links. Blocks javascript:, http:, data: and bad text. */
export function safeCancelUrl(u: string | null | undefined): string | null {
  const t = u?.trim();
  if (!t) return null;
  try {
    return new URL(t).protocol === "https:" ? t : null;
  } catch {
    return null;
  }
}

/** Slug of the Apple or Google store guide that fits this name, or null. */
export function storeHint(name: string): string | null {
  const m = matchGuideSlug(name);
  return m?.kind === "store" ? m.slug : null;
}

export const formatDate = (iso: string | null) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";

export function formatFireAt(iso: string, tz: string): string {
  if (Number.isNaN(Date.parse(iso))) return iso;
  const f = (timeZone: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    }).format(new Date(iso));
  try {
    return f(tz);
  } catch (e) {
    if (e instanceof RangeError) return f("UTC");
    throw e;
  }
}

export type ListView = { rows: SubRowView[]; total: number; params: ListParams };

export async function loadList(
  db: SubDb,
  userId: string,
  sp: Sp,
  now: Date,
): Promise<ListView | "error"> {
  try {
    const [profile, subs] = await Promise.all([db.getProfile(userId), db.listSubs(userId)]);
    const today = todayIn(profile?.timezone ?? "UTC", now);
    const params = parseListParams(sp);
    return {
      rows: filterSort(
        subs.map((s) => toRow(s, today)),
        params,
      ),
      total: subs.length,
      params,
    };
  } catch {
    return "error";
  }
}

export interface DetailView {
  sub: SubFull;
  row: SubRowView;
  status: SubStatus;
  today: string;
  tz: string;
  reminders: HistoryRow[];
  guide: Guide | null;
  store: boolean;
}

export async function loadDetail(
  db: SubDb,
  userId: string,
  id: string,
  now: Date,
  guideLoader: (kind: GuideKind, slug: string) => Promise<Guide | null> = loadGuide,
): Promise<DetailView | "error" | "not_found"> {
  if (!isUuid(id)) return "not_found";
  try {
    const [sub, profile, reminders] = await Promise.all([
      db.getSub(userId, id),
      db.getProfile(userId),
      db.listRemindersForSub(userId, id),
    ]);
    if (!sub) return "not_found";
    const tz = profile?.timezone ?? "UTC";
    const today = todayIn(tz, now);
    const m = matchGuideSlug(sub.name);
    const guide = m ? await guideLoader(m.kind, m.slug).catch(() => null) : null;
    const row = toRow(sub, today);
    return {
      sub,
      row,
      status: row.status,
      today,
      tz,
      reminders,
      guide,
      store: m?.kind === "store",
    };
  } catch {
    return "error";
  }
}
