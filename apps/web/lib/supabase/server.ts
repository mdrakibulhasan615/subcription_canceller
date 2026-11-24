import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. The proxy refreshes them.
        }
      },
    },
  });
}

/** Verified claims for the current request, or null. Shared by layout and page. */
export const getClaims = cache(async () => {
  // Opt out of prerender. The try below would otherwise swallow the dynamic signal.
  await connection();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    return error ? null : (data?.claims ?? null);
  } catch {
    return null;
  }
});
