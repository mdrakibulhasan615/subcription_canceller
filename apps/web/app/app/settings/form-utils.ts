import type { ProfileSettings } from "@app/core";
import type { SaveResult } from "../../../lib/profile-settings";

export type FieldName = keyof ProfileSettings;
export const FIELD_ORDER: FieldName[] = [
  "display_name",
  "timezone",
  "currency",
  "default_stop_days_before",
  "reminder_days",
  "reminder_hour",
  "email_reminders",
];
export const FIELD_LABELS: Record<FieldName, string> = {
  display_name: "Display name",
  timezone: "Timezone",
  currency: "Currency",
  default_stop_days_before: "Default stop days before renewal",
  reminder_days: "Reminder days",
  reminder_hour: "Reminder hour",
  email_reminders: "Send reminders by email",
};

export type FormValues = Record<FieldName, string>;
export type SettingsState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      message: string | null;
      fieldErrors: Partial<Record<FieldName, string>>;
      values: Partial<FormValues>;
    };

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
};
// A blank or bad number becomes NaN, which the schema rejects on that field.
const num = (v: string | undefined) => (v !== undefined && /^\s*\d+\s*$/.test(v) ? Number(v) : NaN);

/** Raw strings as typed, to show again after an error. */
export function formValues(fd: FormData): Partial<FormValues> {
  const out: Partial<FormValues> = {};
  for (const k of FIELD_ORDER) {
    const v = str(fd, k);
    if (v !== undefined) out[k] = v;
  }
  // An unchecked box is not sent at all. "on" means checked, "" means unchecked.
  out.email_reminders = fd.get("email_reminders") === "on" ? "on" : "";
  return out;
}

/** Turns form text into schema input. "7, 3, 1" gives [7, 3, 1]. "7;3" gives [NaN], so it fails. */
export function parseSettingsForm(fd: FormData): Record<string, unknown> {
  const days = str(fd, "reminder_days");
  return {
    display_name: str(fd, "display_name"),
    timezone: str(fd, "timezone")?.trim(),
    currency: str(fd, "currency"),
    default_stop_days_before: num(str(fd, "default_stop_days_before")),
    reminder_days: days === undefined ? undefined : days.split(",").map((d) => num(d)),
    reminder_hour: num(str(fd, "reminder_hour")),
    email_reminders: fd.get("email_reminders") === "on",
  };
}

export const MESSAGES = {
  server: "Settings could not be saved. Please try again.",
  rebuild_failed: "Settings saved. Reminders could not be updated. Try Save again.",
  auth: "Your session ended. Sign in again.",
} as const;

export function toState(result: SaveResult, values: Partial<FormValues>): SettingsState {
  if (result.ok) return { status: "saved" };
  if ("fieldErrors" in result)
    return { status: "error", message: null, fieldErrors: result.fieldErrors, values };
  return { status: "error", message: MESSAGES[result.error], fieldErrors: {}, values };
}

/** Ids for aria-describedby: helper text first, then the error. */
export function describedBy(name: string, hasHelp: boolean, hasError: boolean): string | undefined {
  const ids = [hasHelp && `${name}-help`, hasError && `${name}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}
