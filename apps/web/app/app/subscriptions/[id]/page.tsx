import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getClaims } from "../../../../lib/supabase/server";
import { createSubDb, userIdFrom } from "../../../../lib/subscriptions";
import {
  daysLeftText,
  formatDate,
  formatFireAt,
  formatStampDate,
  loadDetail,
  safeCancelUrl,
} from "../../../../lib/sub-view";
import { PAYMENT_LABELS } from "../form-utils";
import { StatusBadge } from "../status-badge";
import { MerchantControl, ReminderActions } from "./reminder-actions";

export const metadata = { title: "Subscription" };

const h2 = "text-2xl leading-8";
const link = "inline-flex min-h-11 items-center underline underline-offset-2";
const TYPE: Record<string, string> = {
  stop_date: "Stop date",
  renewal: "Renewal",
  trial_end: "Trial end",
};
const CHANNEL: Record<string, string> = { in_app: "In-app", email: "Email", push: "Push" };
const STATE: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  skipped: "Skipped",
};

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = userIdFrom(await getClaims());
  if (!userId) notFound();
  const v = await loadDetail(createSubDb(await createClient()), userId, id, new Date());
  if (v === "not_found") notFound();
  if (v === "error") {
    return (
      <>
        <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Subscription</h1>
        <p role="alert" className="mt-4 text-destructive">
          This subscription could not be loaded. Reload the page to try again.
        </p>
      </>
    );
  }
  const { sub, row, tz, reminders, guide } = v;
  const cancelUrl = safeCancelUrl(sub.cancel_url);
  const payment = PAYMENT_LABELS.find(([k]) => k === sub.payment_method_type)?.[1] ?? "Not set";
  return (
    <>
      <h1 className="text-[32px] leading-[38px] [overflow-wrap:anywhere] md:text-5xl md:leading-[52px]">
        {sub.name}
      </h1>
      <p className="mt-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={v.status} />
        {sub.archived_at && <span className="text-sm text-muted-foreground">Archived</span>}
        <Link href={`/app/subscriptions/${sub.id}/edit`} className={link}>
          Edit
        </Link>
      </p>

      <section className="mt-8">
        <h2 className={h2}>Dates</h2>
        <dl className="mt-2 grid max-w-prose gap-1 tabular-nums">
          <div>
            <dt className="inline text-muted-foreground">Next renewal: </dt>
            <dd className="inline">{formatDate(sub.next_renewal_date)}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Stop date: </dt>
            <dd className="inline">{formatDate(sub.stop_date)}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Days left: </dt>
            <dd className="inline">{daysLeftText(row.daysLeft, !!sub.stop_date)}</dd>
          </div>
          {sub.is_trial && (
            <div>
              <dt className="inline text-muted-foreground">Trial ends: </dt>
              <dd className="inline">{formatDate(sub.trial_end_date)}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2 tabular-nums text-muted-foreground">
          {row.priceText} · {row.cycleText} · {row.monthlyText}
        </p>
      </section>

      <section className="mt-8">
        <h2 className={h2}>Payment</h2>
        <p className="mt-2">{payment}</p>
        {sub.card_nickname && <p>Card nickname: {sub.card_nickname}</p>}
        <p className="text-sm text-muted-foreground">We store a nickname, never a card number.</p>
      </section>

      <section className="mt-8">
        <h2 className={h2}>Notes</h2>
        <p className="mt-2 max-w-prose whitespace-pre-wrap [overflow-wrap:anywhere]">
          {sub.notes || "No notes."}
        </p>
      </section>

      {!sub.archived_at && (
        <section className="mt-8">
          <h2 className={h2}>Stop date actions</h2>
          <ReminderActions
            id={sub.id}
            stoppedText={
              sub.stop_confirmed_at
                ? `Marked as stopped on ${formatStampDate(sub.stop_confirmed_at, tz)}`
                : null
            }
            cancelled={!!sub.merchant_cancelled_at}
            stopDate={sub.stop_date}
            renewal={sub.next_renewal_date}
            today={v.today}
          />
        </section>
      )}

      <section className="mt-8">
        <h2 className={h2}>Cancel with the merchant</h2>
        <p className="mt-2 max-w-prose">Payments stop on the date you set.</p>
        <p className="max-w-prose">
          Blocking a card does not cancel a subscription. The merchant can still try to charge you.
        </p>
        <p className="max-w-prose">
          Freeze or close the card a few days BEFORE renewal, not on the renewal date.
        </p>
        {cancelUrl ? (
          <a href={cancelUrl} target="_blank" rel="noopener noreferrer" className={link}>
            Open cancel link
          </a>
        ) : (
          <p className="mt-2">No cancel link saved. Add one in Edit.</p>
        )}
        {v.store && (
          <p className="mt-2 max-w-prose">
            Apple and Google subscriptions can only be cancelled in your own account settings. We
            cannot cancel them for you.
          </p>
        )}
        <h3 className="mt-4 text-xl">Did you also cancel with the merchant?</h3>
        <MerchantControl
          id={sub.id}
          cancelledText={
            sub.merchant_cancelled_at
              ? `Marked as cancelled with merchant on ${formatStampDate(sub.merchant_cancelled_at, tz)}`
              : null
          }
        />
      </section>

      <section className="mt-8">
        <h2 className={h2}>Guide</h2>
        {guide ? (
          <Link href={`/guides/${guide.kind}/${guide.service_slug}`} className={link}>
            {guide.kind === "cancel" ? `How to cancel ${guide.title}` : guide.title}
          </Link>
        ) : (
          <p className="mt-2">No guide for this service yet.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className={h2}>Reminder history</h2>
        {reminders.length === 0 ? (
          <p className="mt-2">No reminders yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {reminders.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 tabular-nums">
                <span>
                  {TYPE[r.type] ?? r.type} · {CHANNEL[r.channel] ?? r.channel} ·{" "}
                  {formatFireAt(r.fire_at, tz)} ·
                </span>
                {r.status === "failed" ? (
                  <StatusBadge status="failed" />
                ) : (
                  <span>{STATE[r.status] ?? r.status}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
