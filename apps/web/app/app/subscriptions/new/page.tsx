import Link from "next/link";
import { createClient, getClaims } from "../../../../lib/supabase/server";
import { createSubDb, todayIn, userIdFrom } from "../../../../lib/subscriptions";
import { saveSub } from "../actions";
import { SubForm } from "../sub-form";

export const metadata = { title: "Add subscription" };

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const trial = (await searchParams).trial === "1";
  const userId = userIdFrom(await getClaims());
  const profile = userId
    ? await createSubDb(await createClient())
        .getProfile(userId)
        .catch(() => null)
    : null;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Add subscription</h1>
      <p className="mt-4">
        <Link
          href={trial ? "/app/subscriptions/new" : "/app/subscriptions/new?trial=1"}
          className="inline-flex min-h-11 items-center underline underline-offset-2"
        >
          {trial ? "Not a free trial? Add a regular subscription" : "Free trial? Start here"}
        </Link>
      </p>
      {profile ? (
        <SubForm
          key={trial ? "trial" : "regular"}
          trialMode={trial}
          action={saveSub.bind(null, null)}
          isNew
          defaultStopDays={profile.default_stop_days_before}
          today={todayIn(profile.timezone, new Date())}
          initial={{
            name: "",
            price: "",
            currency: profile.currency,
            billing_cycle: "monthly",
            billing_interval: "30",
            next_renewal_date: "",
            stop_date: "",
            category: "",
            payment_method_type: "none",
            card_nickname: "",
            cancel_url: "",
            notes: "",
            is_trial: trial,
            trial_end_date: "",
          }}
        />
      ) : (
        <p className="mt-8 text-destructive">
          Your settings could not be loaded. Reload the page to try again.
        </p>
      )}
    </>
  );
}
