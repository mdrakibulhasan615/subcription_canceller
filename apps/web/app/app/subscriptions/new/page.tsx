import { createClient, getClaims } from "../../../../lib/supabase/server";
import { createSubDb, todayIn, userIdFrom } from "../../../../lib/subscriptions";
import { saveSub } from "../actions";
import { SubForm } from "../sub-form";

export const metadata = { title: "Add subscription" };

export default async function NewSubscriptionPage() {
  const userId = userIdFrom(await getClaims());
  const profile = userId
    ? await createSubDb(await createClient())
        .getProfile(userId)
        .catch(() => null)
    : null;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Add subscription</h1>
      {profile ? (
        <SubForm
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
            is_trial: false,
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
