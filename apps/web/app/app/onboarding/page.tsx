import { createClient, getClaims } from "../../../lib/supabase/server";
import { createDb } from "../../../lib/profile-settings";
import { OnboardingView, parseErrors, parseStep } from "./view";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const step = parseStep(sp.step);
  const claims = await getClaims();
  const profile =
    claims && typeof claims.sub === "string"
      ? await createDb(await createClient())
          .getProfile(claims.sub)
          .catch(() => null)
      : null;
  if (!profile) {
    return (
      <>
        <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Welcome</h1>
        <p role="alert" className="mt-8 text-destructive">
          Your settings could not be loaded. Reload the page to try again.
        </p>
      </>
    );
  }
  return <OnboardingView step={step} profile={profile} errors={parseErrors(step, sp.err)} />;
}
