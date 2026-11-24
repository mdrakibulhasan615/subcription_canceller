"use server";

import { redirect } from "next/navigation";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { createDb } from "../../../lib/profile-settings";
import { track } from "../../../lib/track";
import { runStep, type Step } from "./steps";

export async function saveOnboardingStep(step: Step, formData: FormData): Promise<void> {
  const claims = await getClaims();
  if (!claims || typeof claims.sub !== "string") redirect("/sign-in?next=/app/onboarding");
  let to: string;
  try {
    const supabase = await createClient();
    to = await runStep(
      createDb(supabase),
      claims.sub,
      step === 2 ? 2 : 1,
      formData,
      new Date(),
      (name) => track(supabase, claims.sub as string, name),
    );
  } catch {
    to = `/app/onboarding?step=${step === 2 ? 2 : 1}&err=server`;
  }
  // Outside try/catch: redirect works by throwing.
  redirect(to);
}
