"use server";

import { revalidatePath } from "next/cache";
import type { EventName } from "../../../../lib/events";
import { createClient, getClaims } from "../../../../lib/supabase/server";
import { track } from "../../../../lib/track";
import {
  extendStopDate,
  markMerchantCancelled,
  markStopped,
  unmarkMerchantCancelled,
  unmarkStopped,
  type ExtendResult,
} from "../../../../lib/sub-actions";
import { createSubDb, isUuid, userIdFrom, type SubDb } from "../../../../lib/subscriptions";
import { MESSAGES, type ActionResult } from "../form-utils";

const REBUILD = "Saved, but reminders could not be updated. Try again.";

async function run(
  id: string,
  fn: (db: SubDb, userId: string, now: Date) => Promise<ExtendResult>,
  event?: EventName,
): Promise<ActionResult> {
  const userId = userIdFrom(await getClaims());
  if (!userId) return { ok: false, message: MESSAGES.auth };
  if (!isUuid(id)) return { ok: false, message: MESSAGES.not_found };
  let r: ExtendResult;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  try {
    supabase = await createClient();
    r = await fn(createSubDb(supabase), userId, new Date());
  } catch {
    r = { ok: false, error: "server" };
  }
  revalidatePath(`/app/subscriptions/${id}`);
  revalidatePath("/app/subscriptions");
  revalidatePath("/app", "layout");
  if (r.ok) {
    if (event) track(supabase, userId, event);
    return r;
  }
  if ("fieldError" in r) return { ok: false, message: r.fieldError };
  return { ok: false, message: r.error === "rebuild_failed" ? REBUILD : MESSAGES[r.error] };
}

export async function markStoppedAction(id: string): Promise<ActionResult> {
  return run(id, (db, u, now) => markStopped(db, u, id, now), "subscription_stop_confirmed");
}

export async function unmarkStoppedAction(id: string): Promise<ActionResult> {
  return run(id, (db, u, now) => unmarkStopped(db, u, id, now));
}

export async function markCancelledAction(id: string): Promise<ActionResult> {
  return run(
    id,
    (db, u, now) => markMerchantCancelled(db, u, id, now),
    "merchant_cancelled_marked",
  );
}

export async function unmarkCancelledAction(id: string): Promise<ActionResult> {
  return run(id, (db, u, now) => unmarkMerchantCancelled(db, u, id, now));
}

export async function extendStopAction(id: string, formData: FormData): Promise<ActionResult> {
  const d = formData.get("stop_date");
  return run(
    id,
    (db, u, now) => extendStopDate(db, u, id, typeof d === "string" ? d.trim() : "", now),
    "stop_date_extended",
  );
}
