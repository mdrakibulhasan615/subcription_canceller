import { NextResponse } from "next/server";
import { safeNext } from "../../../lib/auth-routes";
import { createClient } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = () => NextResponse.redirect(`${url.origin}/sign-in?error=callback`, 303);
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) return fail();
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
  } catch {
    return fail();
  }
  return NextResponse.redirect(`${url.origin}${safeNext(url.searchParams.get("next"))}`, 303);
}
