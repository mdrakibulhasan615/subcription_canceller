import { DEFAULT_REMINDER_DAYS } from "@app/core";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { createDb } from "../../../lib/profile-settings";
import { updateSettings } from "./actions";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const claims = await getClaims();
  const profile =
    claims && typeof claims.sub === "string"
      ? await createDb(await createClient())
          .getProfile(claims.sub)
          .catch(() => null)
      : null;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Settings</h1>
      <p className="mt-4 max-w-prose text-lg text-muted-foreground">
        We use your timezone to send reminders at your local hour.
      </p>
      {profile ? (
        <SettingsForm
          action={updateSettings}
          initial={{
            display_name: profile.display_name ?? "",
            timezone: profile.timezone,
            currency: profile.currency,
            default_stop_days_before: String(profile.default_stop_days_before),
            reminder_days: (profile.reminder_days.length
              ? profile.reminder_days
              : DEFAULT_REMINDER_DAYS
            ).join(", "),
            reminder_hour: String(profile.reminder_hour),
            email_reminders: profile.email_reminders ? "on" : "",
          }}
        />
      ) : (
        <p className="mt-8 text-destructive">
          Your settings could not be loaded. Reload the page to try again.
        </p>
      )}
    </>
  );
}
