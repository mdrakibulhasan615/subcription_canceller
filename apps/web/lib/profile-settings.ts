import type { SupabaseClient } from "@supabase/supabase-js";
import {
  planReminders,
  profileSettingsSchema,
  reminderWrites,
  type ExistingReminder,
  type ProfileSettings,
  type ReminderSubInput,
  type ReminderWrites,
} from "@app/core";

export interface SubRow {
  id: string;
  stop_date: string | null;
  next_renewal_date: string | null;
  is_trial: boolean;
  trial_end_date: string | null;
  stop_confirmed_at: string | null;
  merchant_cancelled_at: string | null;
  archived_at: string | null;
}
export interface ReminderRow {
  id: string;
  subscription_id: string;
  type: ExistingReminder["type"];
  channel: ExistingReminder["channel"];
  fire_at: string;
  status: "pending" | "skipped";
}
export type NewReminder = ReminderWrites["insert"][number];

/** The only database calls this feature needs. Methods throw on failure, except insertReminder. */
export interface DbLike {
  getProfile(userId: string): Promise<ProfileSettings | null>;
  updateProfile(userId: string, settings: ProfileSettings): Promise<void>;
  listSubsWithReminders(userId: string): Promise<{ subs: SubRow[]; reminders: ReminderRow[] }>;
  /** Returns the Postgres error code, or null when the row was added. */
  insertReminder(row: NewReminder): Promise<string | null>;
  setReminderStatus(ids: string[], to: "pending" | "skipped"): Promise<void>;
}

export type SaveResult =
  | { ok: true }
  | { ok: false; fieldErrors: Partial<Record<keyof ProfileSettings, string>> }
  | { ok: false; error: "server" | "rebuild_failed" };

export const FIELD_MESSAGES: Record<keyof ProfileSettings, string> = {
  display_name: "Use 80 characters or fewer.",
  timezone: "Enter a valid timezone, like Asia/Kuala_Lumpur.",
  currency: "Choose a currency from the list.",
  default_stop_days_before: "Enter a whole number from 0 to 60.",
  reminder_days: "Enter 1 to 5 whole numbers from 1 to 365, like 7, 3, 1.",
  reminder_hour: "Choose an hour from the list.",
};

const toSubInput = (s: SubRow): ReminderSubInput => ({
  stopDate: s.stop_date,
  nextRenewalDate: s.next_renewal_date,
  isTrial: s.is_trial,
  trialEndDate: s.trial_end_date,
  stopConfirmedAt: s.stop_confirmed_at,
  merchantCancelledAt: s.merchant_cancelled_at,
  archivedAt: s.archived_at,
});

/** Safe to run again: it only applies the difference. Order: insert, skip, reopen. */
export async function rebuildReminders(
  db: DbLike,
  userId: string,
  profile: Pick<ProfileSettings, "timezone" | "reminder_days" | "reminder_hour">,
  now: Date,
): Promise<void> {
  const { subs, reminders } = await db.listSubsWithReminders(userId);
  const inserts: NewReminder[] = [];
  const skipIds: string[] = [];
  const reopenIds: string[] = [];
  for (const sub of subs) {
    const existing = reminders.filter((r) => r.subscription_id === sub.id);
    const diff = planReminders(
      toSubInput(sub),
      {
        timezone: profile.timezone,
        reminderDays: profile.reminder_days,
        sendHour: profile.reminder_hour,
      },
      existing.map((r) => ({
        id: r.id,
        type: r.type,
        channel: r.channel,
        fireAt: r.fire_at,
        status: r.status,
      })),
      now,
    );
    const w = reminderWrites(diff, sub.id, userId);
    inserts.push(...w.insert);
    skipIds.push(...w.skipIds);
    reopenIds.push(...w.reopenIds);
  }
  // shortcut: one request per new row, fine for a few hundred rows; batch if users get many subs.
  const codes = await Promise.all(inserts.map((r) => db.insertReminder(r)));
  // 23505 means the row exists already (for example one that was sent). That is fine.
  const failed = codes.find((c) => c !== null && c !== "23505");
  if (failed) throw new Error(`reminder insert failed: ${failed}`);
  if (skipIds.length) await db.setReminderStatus(skipIds, "skipped");
  if (reopenIds.length) await db.setReminderStatus(reopenIds, "pending");
}

export async function saveProfileSettings(
  db: DbLike,
  userId: string,
  input: unknown,
  now: Date,
): Promise<SaveResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof ProfileSettings, string>> = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0] as keyof ProfileSettings;
      if (k in FIELD_MESSAGES) fieldErrors[k] = FIELD_MESSAGES[k];
    }
    return { ok: false, fieldErrors };
  }
  try {
    await db.updateProfile(userId, parsed.data);
  } catch {
    return { ok: false, error: "server" };
  }
  try {
    // Always rebuild: a retry after a partial failure then repairs the rest.
    await rebuildReminders(db, userId, parsed.data, now);
  } catch {
    return { ok: false, error: "rebuild_failed" };
  }
  return { ok: true };
}

const PROFILE_COLS =
  "display_name, timezone, currency, default_stop_days_before, reminder_days, reminder_hour";
const SUB_COLS =
  "id, stop_date, next_renewal_date, is_trial, trial_end_date, stop_confirmed_at, merchant_cancelled_at, archived_at";
const CHUNK = 100;

/** Supabase adapter. Thin glue, tested only by hand. RLS limits every call to the signed-in user. */
export function createDb(sb: SupabaseClient): DbLike {
  return {
    async getProfile(userId) {
      const { data, error } = await sb
        .from("profiles")
        .select(PROFILE_COLS)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfileSettings | null) ?? null;
    },
    async updateProfile(userId, s) {
      const { data, error } = await sb.from("profiles").update(s).eq("id", userId).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("profile not found");
    },
    async listSubsWithReminders(userId) {
      const subs = await sb.from("subscriptions").select(SUB_COLS).eq("user_id", userId);
      if (subs.error) throw subs.error;
      const rem = await sb
        .from("reminders")
        .select("id, subscription_id, type, channel, fire_at, status")
        .eq("user_id", userId)
        .in("status", ["pending", "skipped"]);
      if (rem.error) throw rem.error;
      return { subs: subs.data as SubRow[], reminders: rem.data as ReminderRow[] };
    },
    async insertReminder(row) {
      const { error } = await sb.from("reminders").insert(row);
      return error ? (error.code ?? "unknown") : null;
    },
    async setReminderStatus(ids, to) {
      const from = to === "pending" ? "skipped" : "pending";
      for (let i = 0; i < ids.length; i += CHUNK) {
        // The status filter skips rows that changed since we read them (for example sent).
        const { error } = await sb
          .from("reminders")
          .update({ status: to })
          .in("id", ids.slice(i, i + CHUNK))
          .eq("status", from);
        if (error) throw error;
      }
    },
  };
}
