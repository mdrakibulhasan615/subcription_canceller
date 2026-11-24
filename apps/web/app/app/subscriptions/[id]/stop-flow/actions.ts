"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { createClient, getClaims } from "../../../../../lib/supabase/server";
import { track } from "../../../../../lib/track";
import { extendError, setStopMethod, type StepError } from "../../../../../lib/stop-flow";
import { extendStopDate, type ExtendResult } from "../../../../../lib/sub-actions";
import { createSubDb, isUuid, userIdFrom } from "../../../../../lib/subscriptions";

async function who(id: string) {
  const userId = userIdFrom(await getClaims());
  if (!userId || !isUuid(id)) notFound();
  return userId;
}

/** Redirect works by throwing, so call it outside try/catch. */
function next(id: string, ok: string, retry: string, err: StepError | null): never {
  const base = `/app/subscriptions/${id}/stop-flow`;
  revalidatePath(`/app/subscriptions/${id}`);
  revalidatePath("/app/subscriptions");
  redirect(err ? `${base}?step=${retry}&err=${err}` : `${base}?step=${ok}`);
}

export async function stopDateStepAction(id: string, formData: FormData): Promise<void> {
  const userId = await who(id);
  const d = formData.get("stop_date");
  let r: ExtendResult;
  try {
    const supabase = await createClient();
    r = await extendStopDate(
      createSubDb(supabase),
      userId,
      id,
      typeof d === "string" ? d.trim() : "",
      new Date(),
    );
    if (r.ok) track(supabase, userId, "stop_date_extended");
  } catch {
    r = { ok: false, error: "server" };
  }
  next(id, "2", "1", extendError(r));
}

export async function stopMethodStepAction(id: string, formData: FormData): Promise<void> {
  const userId = await who(id);
  let err: StepError | null = null;
  try {
    const r = await setStopMethod(
      createSubDb(await createClient()),
      userId,
      id,
      formData.get("method"),
    );
    if (!r.ok) err = r.error === "method" ? "method" : "server";
  } catch {
    err = "server";
  }
  next(id, "3", "2", err);
}
