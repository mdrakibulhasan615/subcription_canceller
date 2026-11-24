import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "../../../../../components/ui/button";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { loadGuide } from "../../../../../lib/guides";
import { createClient, getClaims } from "../../../../../lib/supabase/server";
import {
  methodFor,
  parseStep,
  parseStepError,
  previewReminders,
  STEP_ERRORS,
  STOP_METHODS,
  METHOD_FOOTER,
  type PreviewRow,
} from "../../../../../lib/stop-flow";
import { formatDate, loadDetail } from "../../../../../lib/sub-view";
import { createSubDb, userIdFrom } from "../../../../../lib/subscriptions";
import { ErrorSummary } from "./error-summary";
import { stopDateStepAction, stopMethodStepAction } from "./actions";

export const metadata = { title: "Stop-date flow" };

const h1 = "text-[32px] leading-[38px] md:text-5xl md:leading-[52px]";
const link = "inline-flex min-h-11 items-center underline underline-offset-2";
const TYPE: Record<string, string> = {
  stop_date: "Stop date",
  renewal: "Renewal",
  trial_end: "Trial end",
};
const CHANNEL: Record<string, string> = { in_app: "In-app", email: "Email", push: "Push" };

/** One line per type and time, with the channels joined. */
function group(rows: PreviewRow[]) {
  const m = new Map<string, { type: string; local: string; channels: string[] }>();
  for (const r of rows) {
    const k = `${r.type}|${r.local}`;
    const g = m.get(k) ?? { type: r.type, local: r.local, channels: [] };
    g.channels.push(CHANNEL[r.channel] ?? r.channel);
    m.set(k, g);
  }
  return [...m.values()];
}

export default async function StopFlowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const userId = userIdFrom(await getClaims());
  if (!userId) notFound();
  const db = createSubDb(await createClient());
  const v = await loadDetail(db, userId, id, new Date());
  if (v === "not_found") notFound();
  if (v === "error") {
    return (
      <>
        <h1 className={h1}>Stop-date flow</h1>
        <p role="alert" className="mt-4 text-destructive">
          This subscription could not be loaded. Reload the page to try again.
        </p>
      </>
    );
  }
  const { sub, today } = v;
  const step = parseStep(sp.step);
  const err = parseStepError(sp.err);
  const date = sub.next_renewal_date;
  const inactive = !!(sub.archived_at || sub.stop_confirmed_at || sub.merchant_cancelled_at);
  const detail = `/app/subscriptions/${sub.id}`;
  const head = (n: string, title: string) => (
    <>
      <p className="text-sm text-muted-foreground">
        {n === "done" ? "All steps done" : `Step ${n} of 3`}
      </p>
      <h1 className={h1}>{title}</h1>
      <p className="mt-2 [overflow-wrap:anywhere] text-muted-foreground">{sub.name}</p>
    </>
  );
  const errorBox = err && <ErrorSummary message={STEP_ERRORS[err]} />;
  const nextTo = (s: string) => `${detail}/stop-flow?step=${s}`;

  if (step === "1") {
    return (
      <>
        {head("1", "Set your stop date")}
        <p className="mt-4 max-w-prose">
          The {sub.is_trial ? "trial end" : "renewal"} date is when the merchant charges you. The
          stop date is the day you freeze or close the card. It must come BEFORE the charge.
        </p>
        <dl className="mt-4 grid max-w-prose gap-1 tabular-nums">
          <div>
            <dt className="inline text-muted-foreground">
              {sub.is_trial ? "Trial ends: " : "Next renewal: "}
            </dt>
            <dd className="inline">{formatDate(sub.is_trial ? sub.trial_end_date : date)}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Stop date: </dt>
            <dd className="inline">{formatDate(sub.stop_date)}</dd>
          </div>
        </dl>
        {errorBox}
        <form
          action={stopDateStepAction.bind(null, sub.id)}
          className="mt-6 flex max-w-prose flex-col gap-2"
        >
          <Label htmlFor="stop_date">New stop date</Label>
          <p id="stop_date-help" className="text-sm text-muted-foreground">
            {date
              ? `Pick today or a later date, on or before ${formatDate(date)}.`
              : "Set a renewal date first. Use Edit."}
          </p>
          <Input
            id="stop_date"
            name="stop_date"
            type="date"
            required
            min={today}
            max={date ?? undefined}
            defaultValue={sub.stop_date ?? ""}
            aria-describedby="stop_date-help"
            aria-invalid={err === "past" || err === "after" || err === "invalid" ? true : undefined}
          />
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={!date}>
              Save and continue
            </Button>
            {sub.stop_date && (
              <Link href={nextTo("2")} className={link}>
                Keep {formatDate(sub.stop_date)}
              </Link>
            )}
          </div>
        </form>
      </>
    );
  }

  if (step === "2") {
    const guide = await loadGuide("provider", "wise").catch(() => null);
    const current = methodFor(sub.payment_method_type);
    return (
      <>
        {head("2", "Pick how you will stop payment")}
        {errorBox}
        <form
          action={stopMethodStepAction.bind(null, sub.id)}
          className="mt-6 flex max-w-prose flex-col gap-4"
        >
          <fieldset
            className="flex flex-col gap-3"
            aria-describedby={err ? "step-error" : undefined}
          >
            <legend className="mb-2 text-lg font-medium">How will you stop payment?</legend>
            {STOP_METHODS.map((m) => (
              <label
                key={m.key}
                className="flex items-start gap-3 rounded-lg border border-input p-4"
              >
                <input
                  type="radio"
                  name="method"
                  value={m.key}
                  defaultChecked={current === m.key}
                  className="mt-1 size-5"
                />
                <span>
                  <span className="block font-medium">{m.label}</span>
                  <span className="block text-sm text-muted-foreground">{m.text}</span>
                  {m.key === "wise" &&
                    (guide ? (
                      <Link
                        href="/guides/provider/wise"
                        className="text-sm underline underline-offset-2"
                      >
                        Read the Wise guide
                      </Link>
                    ) : (
                      <span className="block text-sm text-muted-foreground">
                        A Wise guide is coming soon.
                      </span>
                    ))}
                </span>
              </label>
            ))}
          </fieldset>
          <p>{METHOD_FOOTER}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit">Save and continue</Button>
            <Link href={nextTo("1")} className={link}>
              Back
            </Link>
          </div>
        </form>
      </>
    );
  }

  if (step === "3") {
    let rows: PreviewRow[] = [];
    let failed = false;
    try {
      const profile = await db.getProfile(userId);
      if (!profile) throw new Error("no profile");
      rows = previewReminders(sub, profile, new Date());
    } catch {
      failed = true;
    }
    const groups = group(rows);
    return (
      <>
        {head("3", "Remind me to freeze it")}
        {failed ? (
          <p role="alert" className="mt-4 text-destructive">
            Reminders could not be loaded. Reload the page to try again.
          </p>
        ) : inactive ? (
          <p className="mt-4 max-w-prose">No reminders are active for this subscription.</p>
        ) : groups.length === 0 ? (
          <p className="mt-4 max-w-prose">
            No reminders will be sent because the dates have passed.
          </p>
        ) : (
          <>
            <p className="mt-4 max-w-prose">These reminders are set.</p>
            <ul className="mt-2 flex max-w-prose flex-col gap-2 tabular-nums">
              {groups.map((g) => (
                <li key={`${g.type}|${g.local}`}>
                  {TYPE[g.type] ?? g.type}: {g.local} · {g.channels.join(", ")}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 max-w-prose">
          Change when reminders are sent in{" "}
          <Link href="/app/settings" className="underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={nextTo("done")}
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
          >
            Finish
          </Link>
          <Link href={nextTo("2")} className={link}>
            Back
          </Link>
        </div>
      </>
    );
  }

  const trialEnd = formatDate(sub.trial_end_date);
  return (
    <>
      {head("done", "You are all set")}
      {sub.is_trial && (
        <p className="mt-4 max-w-prose">
          The trial ends on {trialEnd}. The first payment can start on {trialEnd}. Freeze or close
          the card a few days before.
        </p>
      )}
      {inactive ? (
        <p className="mt-4 max-w-prose">No reminders are active for this subscription.</p>
      ) : (
        <p className="mt-4 max-w-prose">Payments stop on the date you set.</p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          href={detail}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
        >
          View subscription
        </Link>
        <Link href="/app/subscriptions/new" className={link}>
          Add another
        </Link>
      </div>
    </>
  );
}
