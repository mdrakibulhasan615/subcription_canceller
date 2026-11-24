import { z } from "zod";
import { BILLING_CYCLES } from "./cost";
import { isIsoDate } from "./dates";
import { CURRENCIES } from "./money";

export const isoDateSchema = z.string().refine(isIsoDate, "Not a real date (YYYY-MM-DD)");

export const subscriptionInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    category: z.string().max(50).optional(),
    price_minor: z.number().int().min(0).max(100_000_000),
    currency: z.enum(CURRENCIES),
    billing_cycle: z.enum(BILLING_CYCLES),
    billing_interval: z.number().int().min(1).max(365).default(1),
    next_renewal_date: isoDateSchema,
    cancel_by_date: isoDateSchema.optional(),
    stop_date: isoDateSchema.optional(),
    payment_method_type: z
      .enum(["none", "wise", "privacy", "other_virtual", "managed"])
      .default("none"),
    card_nickname: z.string().max(50).optional(),
    cancel_url: z.url({ protocol: /^https?$/ }).optional(),
    notes: z.string().max(2000).optional(),
    is_trial: z.boolean().default(false),
    trial_end_date: isoDateSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.stop_date && v.stop_date > v.next_renewal_date) {
      ctx.addIssue({
        code: "custom",
        path: ["stop_date"],
        message: "Stop date must be on or before the renewal date",
      });
    }
    if (v.is_trial && !v.trial_end_date) {
      ctx.addIssue({
        code: "custom",
        path: ["trial_end_date"],
        message: "Trial end date is required for a trial",
      });
    }
  });

export type SubscriptionInput = z.infer<typeof subscriptionInputSchema>;
export type StopDateWarning = "stop_in_past" | "stop_after_renewal";

export function stopDateWarnings(
  input: Pick<SubscriptionInput, "stop_date" | "next_renewal_date">,
  today: string,
): StopDateWarning[] {
  const out: StopDateWarning[] = [];
  if (!input.stop_date) return out;
  if (input.stop_date < today) out.push("stop_in_past");
  if (input.stop_date > input.next_renewal_date) out.push("stop_after_renewal");
  return out;
}
