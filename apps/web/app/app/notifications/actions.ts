"use server";

import { revalidatePath } from "next/cache";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { markRead } from "../../../lib/notifications";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RLS limits the update to the signed-in user's rows. A failure leaves the rows unread.
async function run(ids: string[] | "all") {
  if (!(await getClaims())) return;
  try {
    await markRead(await createClient(), ids);
  } catch {
    // The page shows the rows as unread, so the user can try again.
  }
  revalidatePath("/app", "layout");
}

export async function markOneRead(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (typeof id !== "string" || !UUID.test(id)) return;
  await run([id]);
}

export async function markAllRead(): Promise<void> {
  await run("all");
}
