"use server";

import { revalidatePath } from "next/cache";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { createDb, saveProfileSettings } from "../../../lib/profile-settings";
import { formValues, MESSAGES, parseSettingsForm, toState, type SettingsState } from "./form-utils";

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const values = formValues(formData);
  const claims = await getClaims();
  if (!claims || typeof claims.sub !== "string") {
    return { status: "error", message: MESSAGES.auth, fieldErrors: {}, values };
  }
  let state: SettingsState;
  try {
    const db = createDb(await createClient());
    const result = await saveProfileSettings(
      db,
      claims.sub,
      parseSettingsForm(formData),
      new Date(),
    );
    state = toState(result, values);
  } catch {
    state = toState({ ok: false, error: "server" }, values);
  }
  revalidatePath("/app/settings");
  return state;
}
