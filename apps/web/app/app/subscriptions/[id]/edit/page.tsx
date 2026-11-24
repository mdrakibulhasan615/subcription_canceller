import { notFound } from "next/navigation";
import { createClient, getClaims } from "../../../../../lib/supabase/server";
import { createSubDb, isUuid, todayIn, userIdFrom } from "../../../../../lib/subscriptions";
import { saveSub } from "../../actions";
import { SubForm } from "../../sub-form";
import { RowActions } from "./row-actions";

export const metadata = { title: "Edit subscription" };

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = userIdFrom(await getClaims());
  if (!userId || !isUuid(id)) notFound();
  const db = createSubDb(await createClient());
  const [profile, sub] = await Promise.all([
    db.getProfile(userId).catch(() => null),
    db.getSub(userId, id).catch(() => undefined),
  ]);
  if (sub === null) notFound(); // missing or another user's row (RLS hides it)
  if (!profile || !sub) {
    return (
      <p className="text-destructive">
        This subscription could not be loaded. Reload the page to try again.
      </p>
    );
  }
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
        Edit subscription
      </h1>
      <RowActions id={sub.id} name={sub.name} archived={!!sub.archived_at} />
      <SubForm
        action={saveSub.bind(null, id)}
        isNew={false}
        defaultStopDays={profile.default_stop_days_before}
        today={todayIn(profile.timezone, new Date())}
        initial={{
          name: sub.name,
          price: (sub.price_minor / 100).toFixed(2),
          currency: sub.currency,
          billing_cycle: sub.billing_cycle,
          billing_interval: String(sub.billing_interval),
          next_renewal_date: sub.next_renewal_date ?? "",
          stop_date: sub.stop_date ?? "",
          category: sub.category ?? "",
          payment_method_type: sub.payment_method_type,
          card_nickname: sub.card_nickname ?? "",
          cancel_url: sub.cancel_url ?? "",
          notes: sub.notes ?? "",
          is_trial: sub.is_trial,
          trial_end_date: sub.trial_end_date ?? "",
        }}
      />
    </>
  );
}
