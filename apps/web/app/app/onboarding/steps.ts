import type { ProfileSettings } from "@app/core";
import { saveProfileSettings, type DbLike } from "../../../lib/profile-settings";
import type { EventName } from "../../../lib/events";
import { parseSettingsForm } from "../settings/form-utils";

export type Step = 1 | 2;
export const ONBOARDING_FIELDS: Record<Step, (keyof ProfileSettings)[]> = {
  1: ["timezone", "currency"],
  2: ["default_stop_days_before", "reminder_days", "reminder_hour", "email_reminders"],
};
export const BASE = "/app/onboarding";

/** Saved profile, with only this step's fields taken from the form. */
export function buildStepInput(
  profile: ProfileSettings,
  fd: FormData,
  step: Step,
): Record<string, unknown> {
  const parsed = parseSettingsForm(fd);
  const input: Record<string, unknown> = { ...profile, display_name: profile.display_name ?? "" };
  for (const k of ONBOARDING_FIELDS[step]) input[k] = parsed[k];
  return input;
}

/** Saves one step. Returns the path to go to next. */
export async function runStep(
  db: DbLike,
  userId: string,
  step: Step,
  fd: FormData,
  now: Date,
  track?: (name: EventName) => void,
): Promise<string> {
  const back = (err: string) => `${BASE}?step=${step}&err=${err}`;
  try {
    const profile = await db.getProfile(userId);
    if (!profile) return back("server");
    const r = await saveProfileSettings(db, userId, buildStepInput(profile, fd, step), now);
    if (r.ok) {
      // Step 2 is the last settings step. The skip links are plain GET links and send nothing.
      if (step === 2) track?.("onboarding_completed");
      return `${BASE}?step=${step + 1}`;
    }
    if ("fieldErrors" in r) {
      const keys = ONBOARDING_FIELDS[step].filter((k) => r.fieldErrors[k]);
      return back(keys.length ? keys.join(",") : "server");
    }
    return back(r.error);
  } catch {
    return back("server");
  }
}
