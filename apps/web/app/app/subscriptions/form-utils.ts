import type { BillingCycle } from "@app/core";
import type { FieldErrors, SimpleResult, SubField, SubResult } from "../../../lib/subscriptions";

export const FIELD_LABELS: Record<SubField, string> = {
  name: "Name",
  price: "Price",
  currency: "Currency",
  billing_cycle: "Billing cycle",
  billing_interval: "Every N days",
  next_renewal_date: "Next renewal date",
  stop_date: "Stop date",
  category: "Category (optional)",
  payment_method_type: "Payment method",
  card_nickname: "Card nickname (optional)",
  cancel_url: "Cancel link (optional)",
  notes: "Notes (optional)",
  is_trial: "This is a free trial",
  trial_end_date: "Trial end date",
};

export const MESSAGES = {
  server: "Subscription could not be saved. Please try again.",
  not_found: "This subscription no longer exists.",
  rebuild_failed: "Saved. Reminders could not be updated. Try Save again.",
  auth: "Your session ended. Sign in again.",
} as const;

export type SubState =
  | { status: "idle" }
  // savedId: the row exists already (reminders failed), so the next Save edits it, not adds a copy.
  | { status: "error"; message: string | null; fieldErrors: FieldErrors; savedId?: string };

export type ActionResult = { ok: true } | { ok: false; message: string };

export const errorState = (message: string, savedId?: string): SubState => ({
  status: "error",
  message,
  fieldErrors: {},
  savedId,
});

export function toState(result: SubResult, savedId?: string): SubState {
  if (result.ok) return { status: "idle" };
  if ("fieldErrors" in result) {
    return { status: "error", message: null, fieldErrors: result.fieldErrors, savedId };
  }
  return errorState(MESSAGES[result.error], result.id ?? savedId);
}

export const toActionResult = (r: SimpleResult): ActionResult =>
  r.ok ? r : { ok: false, message: MESSAGES[r.error] };

export const PAYMENT_LABELS = [
  ["none", "Not set"],
  ["wise", "Wise virtual card"],
  ["privacy", "Privacy.com card"],
  ["other_virtual", "Other virtual card"],
] as const;
export const CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
  custom: "Custom (every N days)",
};
