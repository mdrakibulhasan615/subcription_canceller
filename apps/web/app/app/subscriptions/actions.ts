"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getClaims } from "../../../lib/supabase/server";
import {
  archiveSubscription,
  createSubDb,
  deleteSubscription,
  isUuid,
  saveSubscription,
  unarchiveSubscription,
  userIdFrom,
  type SimpleResult,
  type SubDb,
  type SubResult,
} from "../../../lib/subscriptions";
import {
  errorState,
  MESSAGES,
  toActionResult,
  toState,
  type ActionResult,
  type SubState,
} from "./form-utils";

const LIST = "/app/subscriptions";

export async function saveSub(
  id: string | null,
  _prev: SubState,
  formData: FormData,
): Promise<SubState> {
  const userId = userIdFrom(await getClaims());
  if (!userId) return errorState(MESSAGES.auth);
  // After a failed reminder rebuild the form sends the new row id back, so Save edits it.
  const hidden = formData.get("sub_id");
  const target = id ?? (isUuid(hidden) ? hidden : null);
  let result: SubResult;
  try {
    result = await saveSubscription(
      createSubDb(await createClient()),
      userId,
      target,
      formData,
      new Date(),
    );
  } catch {
    result = { ok: false, error: "server" };
  }
  revalidatePath(LIST);
  if (result.ok) redirect(LIST); // outside try/catch: redirect works by throwing
  return toState(result, target ?? undefined);
}

async function run(
  id: string,
  fn: (db: SubDb, userId: string, id: string, now: Date) => Promise<SimpleResult>,
): Promise<ActionResult> {
  const userId = userIdFrom(await getClaims());
  if (!userId) return { ok: false, message: MESSAGES.auth };
  if (!isUuid(id)) return { ok: false, message: MESSAGES.not_found };
  let result: SimpleResult;
  try {
    result = await fn(createSubDb(await createClient()), userId, id, new Date());
  } catch {
    result = { ok: false, error: "server" };
  }
  revalidatePath(LIST);
  return toActionResult(result);
}

export async function archiveSub(id: string): Promise<ActionResult> {
  return run(id, archiveSubscription);
}

export async function unarchiveSub(id: string): Promise<ActionResult> {
  return run(id, unarchiveSubscription);
}

export async function deleteSub(id: string): Promise<ActionResult> {
  const r = await run(id, deleteSubscription);
  if (r.ok) redirect(LIST);
  return r;
}
