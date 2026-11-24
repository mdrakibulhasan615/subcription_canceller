import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultStopDate,
  isIsoDate,
  subscriptionInputSchema,
  toMinor,
  type Currency,
  type ProfileSettings,
} from "@app/core";
import { looksLikeCardNumber } from "./card-guard";
import { createDb, rebuildReminders, type DbLike } from "./profile-settings";

export const SUB_FIELDS = [
  "name",
  "price",
  "currency",
  "billing_cycle",
  "billing_interval",
  "next_renewal_date",
  "stop_date",
  "category",
  "payment_method_type",
  "card_nickname",
  "cancel_url",
  "notes",
  "is_trial",
  "trial_end_date",
] as const;
export type SubField = (typeof SUB_FIELDS)[number];
export type FieldErrors = Partial<Record<SubField, string>>;

/** Columns the form writes. Never stop_confirmed_at or merchant_cancelled_at (T-012). */
export interface SubWrite {
  name: string;
  category: string | null;
  price_minor: number;
  currency: Currency;
  billing_cycle: string;
  billing_interval: number;
  next_renewal_date: string;
  stop_date: string;
  payment_method_type: string;
  card_nickname: string | null;
  cancel_url: string | null;
  notes: string | null;
  is_trial: boolean;
  trial_end_date: string | null;
}
export type SubDetail = SubWrite & { id: string; archived_at: string | null };
/** A stored row with the status columns. The renewal and stop dates may be null in the DB. */
export type SubFull = Omit<SubDetail, "next_renewal_date" | "stop_date"> & {
  next_renewal_date: string | null;
  stop_date: string | null;
  stop_confirmed_at: string | null;
  merchant_cancelled_at: string | null;
  created_at: string;
};
export interface HistoryRow {
  type: string;
  channel: string;
  fire_at: string;
  status: string;
  sent_at: string | null;
}

/** Methods throw on failure. The boolean is false when no row of this user matched. */
export interface SubDb extends DbLike {
  getSub(userId: string, id: string): Promise<SubFull | null>;
  listSubs(userId: string): Promise<SubFull[]>;
  listRemindersForSub(userId: string, subId: string): Promise<HistoryRow[]>;
  listSubNames(userId: string): Promise<{ id: string; name: string; archived_at: string | null }[]>;
  insertSub(row: SubWrite & { user_id: string }): Promise<string>;
  updateSub(userId: string, id: string, row: SubWrite): Promise<boolean>;
  setArchived(userId: string, id: string, at: string | null): Promise<boolean>;
  deleteSub(userId: string, id: string): Promise<boolean>;
  /** Narrow write for T-012. Touches only the columns in the patch. */
  patchSub(userId: string, id: string, patch: SubPatch): Promise<boolean>;
}
export interface SubPatch {
  stop_confirmed_at?: string | null;
  merchant_cancelled_at?: string | null;
  stop_date?: string;
}

type ErrorCode = "server" | "not_found" | "rebuild_failed";
export type SubResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; error: ErrorCode; id?: string };
export type SimpleResult = { ok: true } | { ok: false; error: ErrorCode };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/** The signed-in user id from verified claims, or null. */
export function userIdFrom(claims: { sub?: unknown } | null): string | null {
  return claims && typeof claims.sub === "string" && claims.sub ? claims.sub : null;
}

/** Today as YYYY-MM-DD in the user's timezone. A bad timezone falls back to UTC. */
export function todayIn(timezone: string, now: Date): string {
  try {
    return now.toLocaleDateString("en-CA", { timeZone: timezone });
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export const FIELD_MESSAGES: Record<SubField, string> = {
  name: "Enter a name, 100 characters or fewer.",
  price: "Enter an amount like 9.99, up to 1000000.00.",
  currency: "Choose a currency from the list.",
  billing_cycle: "Choose a billing cycle from the list.",
  billing_interval: "Enter a whole number of days from 1 to 365.",
  next_renewal_date: "Enter a real date.",
  stop_date: "Enter a real date.",
  category: "Use 50 characters or fewer.",
  payment_method_type: "Choose a payment method from the list.",
  card_nickname: "Use 50 characters or fewer.",
  cancel_url: "Enter a full web address, like https://example.com/cancel.",
  notes: "Use 2000 characters or fewer.",
  is_trial: "Choose yes or no.",
  trial_end_date: "Enter a real date.",
};
export const CARD_MESSAGE = "This looks like a card number. Remove it. Use a nickname only.";

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
const opt = (v: string) => (v === "" ? undefined : v);

export type ParseResult = { ok: true; data: SubWrite } | { ok: false; fieldErrors: FieldErrors };

export function parseSubForm(
  fd: FormData,
  profile: Pick<ProfileSettings, "default_stop_days_before">,
): ParseResult {
  const errors: FieldErrors = {};
  const currency = text(fd, "currency");
  const cycle = text(fd, "billing_cycle");
  let price_minor = NaN;
  try {
    price_minor = toMinor(text(fd, "price"), currency as Currency);
  } catch {
    errors.price = FIELD_MESSAGES.price;
  }
  const card_nickname = opt(text(fd, "card_nickname"));
  const notes = opt(text(fd, "notes"));
  if (card_nickname && looksLikeCardNumber(card_nickname)) errors.card_nickname = CARD_MESSAGE;
  if (notes && looksLikeCardNumber(notes)) errors.notes = CARD_MESSAGE;
  const cancel_url = opt(text(fd, "cancel_url"));
  if (cancel_url && !/^https?:\/\//i.test(cancel_url)) errors.cancel_url = "Start with https://";
  const payment_method_type = text(fd, "payment_method_type") || "none";
  // "managed" is POST_MVP. The schema allows it, so block it here.
  if (payment_method_type === "managed") {
    errors.payment_method_type = FIELD_MESSAGES.payment_method_type;
  }
  const renewal = opt(text(fd, "next_renewal_date"));
  const stop_date =
    opt(text(fd, "stop_date")) ??
    (renewal && isIsoDate(renewal)
      ? defaultStopDate(renewal, profile.default_stop_days_before)
      : undefined);
  const is_trial = fd.get("is_trial") === "on";
  const intervalText = text(fd, "billing_interval");
  const interval = /^\d+$/.test(intervalText) ? Number(intervalText) : NaN;
  const parsed = subscriptionInputSchema.safeParse({
    name: text(fd, "name"),
    category: opt(text(fd, "category")),
    price_minor,
    currency,
    billing_cycle: cycle,
    billing_interval: cycle === "custom" ? interval : 1,
    next_renewal_date: renewal,
    stop_date,
    payment_method_type,
    card_nickname,
    cancel_url,
    notes,
    is_trial,
    trial_end_date: is_trial ? opt(text(fd, "trial_end_date")) : undefined,
  });
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const p = i.path[0] === "price_minor" ? "price" : i.path[0];
      const k = (SUB_FIELDS as readonly unknown[]).includes(p) ? (p as SubField) : null;
      // Our own messages come first. Custom schema rules (stop after renewal) keep their text.
      if (k && !errors[k]) errors[k] = i.code === "custom" ? i.message : FIELD_MESSAGES[k];
    }
  }
  if (!parsed.success || Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  const d = parsed.data;
  return {
    ok: true,
    data: {
      name: d.name,
      category: d.category ?? null,
      price_minor: d.price_minor,
      currency: d.currency,
      billing_cycle: d.billing_cycle,
      billing_interval: d.billing_interval,
      next_renewal_date: d.next_renewal_date,
      stop_date: d.stop_date as string, // always set: a blank input gets the default
      payment_method_type: d.payment_method_type,
      card_nickname: d.card_nickname ?? null,
      cancel_url: d.cancel_url ?? null,
      notes: d.notes ?? null,
      is_trial: d.is_trial,
      trial_end_date: d.trial_end_date ?? null,
    },
  };
}

/** Rebuild reminders. A bad profile timezone throws RangeError: retry once with UTC. */
export async function safeRebuild(
  db: DbLike,
  userId: string,
  profile: Pick<ProfileSettings, "timezone" | "reminder_days" | "reminder_hour">,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: "rebuild_failed" }> {
  try {
    await rebuildReminders(db, userId, profile, now);
    return { ok: true };
  } catch (e) {
    if (e instanceof RangeError) {
      try {
        await rebuildReminders(db, userId, { ...profile, timezone: "UTC" }, now);
        return { ok: true };
      } catch {
        // fall through
      }
    }
    return { ok: false, error: "rebuild_failed" };
  }
}

export async function saveSubscription(
  db: SubDb,
  userId: string,
  id: string | null,
  fd: FormData,
  now: Date,
): Promise<SubResult> {
  let profile: ProfileSettings | null;
  try {
    profile = await db.getProfile(userId);
  } catch {
    return { ok: false, error: "server" };
  }
  if (!profile) return { ok: false, error: "server" };
  const parsed = parseSubForm(fd, profile);
  if (!parsed.ok) return parsed;
  let savedId: string;
  try {
    if (id) {
      if (!(await db.updateSub(userId, id, parsed.data))) return { ok: false, error: "not_found" };
      savedId = id;
    } else {
      savedId = await db.insertSub({ ...parsed.data, user_id: userId });
    }
  } catch {
    return { ok: false, error: "server" };
  }
  const r = await safeRebuild(db, userId, profile, now);
  return r.ok ? { ok: true, id: savedId } : { ...r, id: savedId };
}

export async function change(
  db: SubDb,
  userId: string,
  now: Date,
  write: () => Promise<boolean>,
  rebuild: boolean,
): Promise<SimpleResult> {
  let profile: ProfileSettings | null = null;
  try {
    if (rebuild) {
      profile = await db.getProfile(userId);
      if (!profile) return { ok: false, error: "server" };
    }
    if (!(await write())) return { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "server" };
  }
  return profile ? safeRebuild(db, userId, profile, now) : { ok: true };
}

export const archiveSubscription = (db: SubDb, userId: string, id: string, now: Date) =>
  change(db, userId, now, () => db.setArchived(userId, id, now.toISOString()), true);

export const unarchiveSubscription = (db: SubDb, userId: string, id: string, now: Date) =>
  change(db, userId, now, () => db.setArchived(userId, id, null), true);

/** Reminders go with the row (cascade), so no rebuild is needed. */
export const deleteSubscription = (db: SubDb, userId: string, id: string, now: Date) =>
  change(db, userId, now, () => db.deleteSub(userId, id), false);

const COLS =
  "id, name, category, price_minor, currency, billing_cycle, billing_interval, next_renewal_date, stop_date, payment_method_type, card_nickname, cancel_url, notes, is_trial, trial_end_date, archived_at, stop_confirmed_at, merchant_cancelled_at, created_at";

/** Supabase adapter. Thin glue, tested only by hand. RLS limits every call to the signed-in user. */
export function createSubDb(sb: SupabaseClient): SubDb {
  const mine = (userId: string, id: string) => ({ id, user_id: userId });
  return {
    ...createDb(sb),
    async getSub(userId, id) {
      const { data, error } = await sb
        .from("subscriptions")
        .select(COLS)
        .match(mine(userId, id))
        .maybeSingle();
      if (error) throw error;
      return (data as SubFull | null) ?? null;
    },
    async listSubs(userId) {
      const { data, error } = await sb.from("subscriptions").select(COLS).eq("user_id", userId);
      if (error) throw error;
      return data as SubFull[];
    },
    async listRemindersForSub(userId, subId) {
      const { data, error } = await sb
        .from("reminders")
        .select("type, channel, fire_at, status, sent_at")
        .match({ user_id: userId, subscription_id: subId })
        .order("fire_at");
      if (error) throw error;
      return data as HistoryRow[];
    },
    async listSubNames(userId) {
      const { data, error } = await sb
        .from("subscriptions")
        .select("id, name, archived_at")
        .eq("user_id", userId)
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; archived_at: string | null }[];
    },
    async insertSub(row) {
      const { data, error } = await sb.from("subscriptions").insert(row).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    async updateSub(userId, id, row) {
      const { data, error } = await sb
        .from("subscriptions")
        .update(row)
        .match(mine(userId, id))
        .select("id");
      if (error) throw error;
      return !!data?.length;
    },
    async setArchived(userId, id, at) {
      const { data, error } = await sb
        .from("subscriptions")
        .update({ archived_at: at })
        .match(mine(userId, id))
        .select("id");
      if (error) throw error;
      return !!data?.length;
    },
    async patchSub(userId, id, patch) {
      const { data, error } = await sb
        .from("subscriptions")
        .update(patch)
        .match(mine(userId, id))
        .select("id");
      if (error) throw error;
      return !!data?.length;
    },
    async deleteSub(userId, id) {
      const { data, error } = await sb
        .from("subscriptions")
        .delete()
        .match(mine(userId, id))
        .select("id");
      if (error) throw error;
      return !!data?.length;
    },
  };
}
