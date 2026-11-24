import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Bypasses RLS. Import only from server actions that need it. */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Admin client is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
