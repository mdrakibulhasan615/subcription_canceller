import { isIsoDate } from "@app/core";
import { change, safeRebuild, todayIn, type SimpleResult, type SubDb } from "./subscriptions";

export type ExtendResult = SimpleResult | { ok: false; fieldError: string };

const stamp =
  (key: "stop_confirmed_at" | "merchant_cancelled_at", on: boolean) =>
  (db: SubDb, userId: string, id: string, now: Date) =>
    change(
      db,
      userId,
      now,
      async () => {
        const s = await db.getSub(userId, id);
        if (!s) return false;
        // Already in the wanted state: keep the original timestamp.
        if (on === !!s[key]) return true;
        return db.patchSub(userId, id, { [key]: on ? now.toISOString() : null });
      },
      true,
    );

export const markStopped = stamp("stop_confirmed_at", true);
export const unmarkStopped = stamp("stop_confirmed_at", false);
export const markMerchantCancelled = stamp("merchant_cancelled_at", true);
export const unmarkMerchantCancelled = stamp("merchant_cancelled_at", false);

const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** Move the stop date later. Snooze = this. Reminders are rebuilt from the new date. */
export async function extendStopDate(
  db: SubDb,
  userId: string,
  id: string,
  newDate: string,
  now: Date,
): Promise<ExtendResult> {
  if (!isIsoDate(newDate)) return { ok: false, fieldError: "Enter a real date." };
  try {
    const [profile, sub] = await Promise.all([db.getProfile(userId), db.getSub(userId, id)]);
    if (!profile) return { ok: false, error: "server" };
    if (!sub) return { ok: false, error: "not_found" };
    const renewal = sub.next_renewal_date;
    if (!renewal || newDate > renewal) {
      return {
        ok: false,
        fieldError: renewal
          ? `Pick a date on or before the renewal date, ${fmt(renewal)}.`
          : "Set a renewal date first. Use Edit.",
      };
    }
    if (newDate < todayIn(profile.timezone, now)) {
      return { ok: false, fieldError: "That date has passed. Pick today or a later date." };
    }
    if (!(await db.patchSub(userId, id, { stop_date: newDate }))) {
      return { ok: false, error: "not_found" };
    }
    return await safeRebuild(db, userId, profile, now);
  } catch {
    return { ok: false, error: "server" };
  }
}
