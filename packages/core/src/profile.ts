import { z } from "zod";
import { CURRENCIES } from "./money";
import { isValidTimezone } from "./timezone";

export const DEFAULT_REMINDER_DAYS = [7, 3, 1];

export const profileSettingsSchema = z.object({
  display_name: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v === "" ? null : v)),
  timezone: z.string().max(64).refine(isValidTimezone, "Not a valid timezone"),
  currency: z.enum(CURRENCIES),
  default_stop_days_before: z.number().int().min(0).max(60),
  reminder_days: z
    .array(z.number().int().min(1).max(365))
    .min(1)
    .max(5)
    .transform((d) => [...new Set(d)].sort((a, b) => b - a)),
  reminder_hour: z.number().int().min(0).max(23),
  email_reminders: z.boolean(),
});

export type ProfileSettings = z.infer<typeof profileSettingsSchema>;

type ReminderFields = Pick<ProfileSettings, "timezone" | "reminder_hour" | "reminder_days">;

const daysKey = (d: number[]) => [...new Set(d)].sort((a, b) => b - a).join(",");

/** True when a change affects reminder times. */
export function needsReminderRebuild(before: ReminderFields, after: ReminderFields): boolean {
  return (
    before.timezone !== after.timezone ||
    before.reminder_hour !== after.reminder_hour ||
    daysKey(before.reminder_days) !== daysKey(after.reminder_days)
  );
}
