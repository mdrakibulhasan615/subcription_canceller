import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { expect, type BrowserContext } from "@playwright/test";

export function env(name: string): string {
  const v = process.env[name];
  if (!v)
    throw new Error(`e2e: env ${name} is not set (the e2e workflow sets it from supabase status)`);
  return v;
}

/** Service-role client for the LOCAL CI stack only. Bypasses RLS. */
export const admin = () =>
  createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Fresh confirmed user (profile row comes from the DB trigger). Each test makes its own. */
export async function createUser(): Promise<TestUser> {
  const email = `e2e+${randomUUID()}@example.test`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`e2e: createUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/**
 * Signs in with the password and puts the session in the browser context as cookies.
 * The cookies are written by the real @supabase/ssr server client (same package and version
 * as the app), so name (sb-<ref>-auth-token), base64url value and chunking always match.
 * Nothing is derived by hand.
 */
export async function signIn(context: BrowserContext, user: TestUser): Promise<void> {
  const jar = new Map<string, { value: string; maxAge?: number }>();
  const client = createServerClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => [...jar].map(([name, c]) => ({ name, value: c.value })),
        setAll: (list) => {
          for (const c of list) {
            if (c.value) jar.set(c.name, { value: c.value, maxAge: c.options?.maxAge });
            else jar.delete(c.name);
          }
        },
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`e2e: password sign-in failed: ${error.message}`);
  // The cookie write runs in an auth state callback: wait for it.
  await expect
    .poll(() => jar.size, { message: "session cookies were not written" })
    .toBeGreaterThan(0);
  await context.addCookies(
    [...jar].map(([name, c]) => ({
      name,
      value: c.value,
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + (c.maxAge ?? 3600),
    })),
  );
}
