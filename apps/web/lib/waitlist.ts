import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  website: z.string().optional(),
  source: z.string().max(64).optional(),
});

export function getAnonClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Plain insert: anon has no SELECT, so no select/upsert/onConflict.
export async function joinWaitlist(
  client: Pick<SupabaseClient, "from">,
  email: string,
  source?: string,
): Promise<"ok" | "duplicate"> {
  const { error } = await client.from("waitlist").insert({ email, source });
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  throw new Error("waitlist insert failed");
}
