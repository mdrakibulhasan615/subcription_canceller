import { desiredReminders, type ProfileSettings } from "@app/core";
import type { ExtendResult } from "./sub-actions";
import { formatFireAt } from "./sub-view";
import type { SimpleResult, SubDb, SubFull } from "./subscriptions";

export const STEPS = ["1", "2", "3", "done"] as const;
export type Step = (typeof STEPS)[number];
/** Unknown or missing value: step 1. */
export const parseStep = (v: string | string[] | undefined): Step =>
  STEPS.find((s) => s === (Array.isArray(v) ? v[0] : v)) ?? "1";

export const METHOD_FOOTER = "Blocking a card does not cancel a subscription.";
export const STOP_METHODS = [
  {
    key: "wise",
    label: "Wise virtual card",
    text: "Create a card in Wise for this subscription, or freeze the card you already use for it.",
    payment: "wise",
  },
  {
    key: "privacy",
    label: "Privacy.com card",
    text: "Pause or close the Privacy card for this subscription.",
    payment: "privacy",
  },
  {
    key: "other_virtual",
    label: "Other virtual card",
    text: "Freeze or close the card for this subscription.",
    payment: "other_virtual",
  },
  {
    key: "merchant",
    label: "Cancel with the merchant",
    text: "Cancel the subscription with the merchant before the stop date.",
    payment: "none",
  },
] as const;
export type MethodKey = (typeof STOP_METHODS)[number]["key"];
export const methodText = (m: { text: string }) => `${m.text} ${METHOD_FOOTER}`;

/** The method that matches the stored payment type (for the default radio). */
export const methodFor = (payment: string): MethodKey | null =>
  STOP_METHODS.find((m) => m.payment === payment && m.key !== "merchant")?.key ?? null;

/** Stop date passed, and the user has not confirmed, cancelled or archived. */
export const stopPassed = (
  s: Pick<SubFull, "stop_date" | "stop_confirmed_at" | "merchant_cancelled_at" | "archived_at">,
  today: string,
): boolean =>
  !!s.stop_date &&
  s.stop_date < today &&
  !s.stop_confirmed_at &&
  !s.merchant_cancelled_at &&
  !s.archived_at;

export interface PreviewRow {
  type: string;
  channel: string;
  local: string;
}

/** Pure: what reminders the saved dates give. Past ones are left out. A bad timezone uses UTC. */
export function previewReminders(
  sub: SubFull,
  profile: Pick<ProfileSettings, "timezone" | "reminder_days" | "reminder_hour">,
  now: Date,
): PreviewRow[] {
  const input = {
    stopDate: sub.stop_date,
    nextRenewalDate: sub.next_renewal_date,
    isTrial: sub.is_trial,
    trialEndDate: sub.trial_end_date,
    stopConfirmedAt: sub.stop_confirmed_at,
    merchantCancelledAt: sub.merchant_cancelled_at,
    archivedAt: sub.archived_at,
  };
  const run = (timezone: string) =>
    desiredReminders(
      input,
      { timezone, reminderDays: profile.reminder_days, sendHour: profile.reminder_hour },
      now,
    );
  let tz = profile.timezone;
  let list;
  try {
    list = run(tz);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    tz = "UTC";
    list = run(tz);
  }
  return list.map((r) => ({ type: r.type, channel: r.channel, local: formatFireAt(r.fireAt, tz) }));
}

export type StepError = "past" | "after" | "invalid" | "norenewal" | "method" | "server";
export const STEP_ERRORS: Record<StepError, string> = {
  past: "That date has passed. Pick today or a later date.",
  after: "Pick a date on or before the renewal date.",
  invalid: "Enter a real date.",
  norenewal: "Set a renewal date first. Use Edit.",
  method: "Choose one of the options.",
  server: "Something went wrong. Please try again.",
};
export const parseStepError = (v: string | string[] | undefined): StepError | null => {
  const k = Array.isArray(v) ? v[0] : v;
  return (Object.keys(STEP_ERRORS) as StepError[]).find((e) => e === k) ?? null;
};

/** Maps an extendStopDate result to a closed error code, or null on success. */
export function extendError(r: ExtendResult): StepError | null {
  if (r.ok) return null;
  if (!("fieldError" in r)) return "server";
  const t = r.fieldError;
  if (t.startsWith("That date has passed")) return "past";
  if (t.startsWith("Pick a date on or before")) return "after";
  if (t.startsWith("Set a renewal")) return "norenewal";
  return "invalid";
}

/** Save the chosen stop method as the payment type. No reminder rebuild: dates do not change. */
export async function setStopMethod(
  db: SubDb,
  userId: string,
  id: string,
  method: unknown,
): Promise<SimpleResult | { ok: false; error: "method" }> {
  const m = STOP_METHODS.find((x) => x.key === method);
  if (!m) return { ok: false, error: "method" };
  try {
    return (await db.patchSub(userId, id, { payment_method_type: m.payment }))
      ? { ok: true }
      : { ok: false, error: "not_found" };
  } catch {
    return { ok: false, error: "server" };
  }
}
