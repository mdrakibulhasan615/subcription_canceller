import { NextResponse } from "next/server";
import { ONBOARDING_PATH, postSignInPath, safeNext } from "../../../lib/auth-routes";
import { createClient } from "../../../lib/supabase/server";
import { track } from "../../../lib/track";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = () => NextResponse.redirect(`${url.origin}/sign-in?error=callback`, 303);
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) return fail();
  let target = safeNext(url.searchParams.get("next"));
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail();
    target = await onboardingTarget(supabase, data?.user?.id, target);
  } catch {
    return fail();
  }
  return NextResponse.redirect(`${url.origin}${target}`, 303);
}

/** Never blocks sign-in: any failure here keeps the normal target. */
async function onboardingTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | undefined,
  target: string,
): Promise<string> {
  if (!userId) return target;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return target;
    const path = postSignInPath(target, data.onboarded_at);
    if (path !== ONBOARDING_PATH) return target;
    // One-shot: set the flag now so an abandoned onboarding is not shown again.
    const upd = await supabase
      .from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", userId)
      .is("onboarded_at", null);
    if (upd.error) return target;
    track(supabase, userId, "signed_in_first");
    return path;
  } catch {
    return target;
  }
}
