import Link from "next/link";
import { formatMoney } from "@app/core";
import { createClient, getClaims } from "../../lib/supabase/server";
import {
  HONEST_NOTE,
  SAVINGS_NOTE,
  currenciesIn,
  dueText,
  loadDashboard,
  skippedText,
  type DashboardView,
} from "../../lib/dashboard";
import { formatDate } from "../../lib/sub-view";
import { createSubDb, userIdFrom } from "../../lib/subscriptions";
import { hasAnswered, type FeedbackDb } from "../../lib/card-interest";
import { CardInterest } from "./card-interest";
import { Nudge } from "./nudge";
import { StatusBadge } from "./subscriptions/status-badge";

export const metadata = { title: "Dashboard" };

const btn =
  "inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:opacity-90";
const card = "rounded-lg border border-border bg-card p-4 text-card-foreground";
const h2 = "mt-12 text-2xl md:text-3xl";

function AddCta({ text }: { text: string }) {
  return (
    <>
      <p className="mt-8 max-w-prose text-lg text-muted-foreground">{text}</p>
      <Link href="/app/subscriptions/new" className={`mt-6 ${btn}`}>
        Add subscription
      </Link>
    </>
  );
}

function Savings({ v }: { v: DashboardView }) {
  const cs = currenciesIn(v.savings.yearly);
  return (
    <section aria-labelledby="savings-h">
      <h2 id="savings-h" className={h2}>
        Estimated savings
      </h2>
      {cs.length === 0 ? (
        <p className="mt-4 max-w-prose text-muted-foreground">
          Nothing stopped yet. When you stop a subscription, an estimate shows here.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {cs.map((c) => (
            <li key={c} className={card}>
              <p className="text-sm text-muted-foreground">{c}</p>
              <p className="text-xl font-semibold tabular-nums">
                About {formatMoney(v.savings.yearly[c] ?? 0, c)} a year
              </p>
              <p className="tabular-nums text-muted-foreground">
                About {formatMoney(v.savings.monthly[c] ?? 0, c)} a month
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 max-w-prose text-sm text-muted-foreground">{SAVINGS_NOTE}</p>
    </section>
  );
}

function Counted({ v }: { v: DashboardView }) {
  const cs = currenciesIn(v.totals.monthly);
  return (
    <>
      <section aria-labelledby="totals-h">
        <h2 id="totals-h" className={h2}>
          Totals
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {cs.map((c) => (
            <li key={c} className={card}>
              <p className="text-sm text-muted-foreground">{c}</p>
              <p className="tabular-nums">
                <span className="text-muted-foreground">Per month: </span>
                <span className="text-xl font-semibold">
                  {formatMoney(v.totals.monthly[c] ?? 0, c)}
                </span>
              </p>
              <p className="tabular-nums">
                <span className="text-muted-foreground">Per year: </span>
                <span className="text-xl font-semibold">
                  {formatMoney(v.totals.yearly[c] ?? 0, c)}
                </span>
              </p>
            </li>
          ))}
        </ul>
        {v.totals.skipped > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">{skippedText(v.totals.skipped)}</p>
        )}
      </section>
      <section aria-labelledby="next-h">
        <h2 id="next-h" className={h2}>
          Next 5 dates
        </h2>
        {v.upcoming.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No dates set yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {v.upcoming.map((e) => (
              <li key={`${e.subId}-${e.kind}`} className={`${card} flex flex-col gap-2`}>
                <Link
                  href={`/app/subscriptions/${e.subId}`}
                  className="inline-flex min-h-11 items-center text-lg font-semibold underline underline-offset-4 [overflow-wrap:anywhere]"
                >
                  {e.name}
                </Link>
                <p className="flex flex-wrap items-center gap-2 tabular-nums">
                  <span>{e.kind === "stop" ? "Stop date" : "Renewal"}</span>
                  <span>{formatDate(e.date)}</span>
                  <span className="text-muted-foreground">
                    {dueText(e.daysLeft, e.kind === "stop")}
                  </span>
                  <StatusBadge status={e.status} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Categories({ v }: { v: DashboardView }) {
  return (
    <section aria-labelledby="cat-h">
      <h2 id="cat-h" className={h2}>
        Spending by category
      </h2>
      {currenciesIn(v.totals.monthly).map((c) => (
        <table key={c} className="mt-4 w-full text-left">
          <caption className="pb-2 text-left font-semibold">{c}</caption>
          <thead>
            <tr className="text-sm text-muted-foreground">
              <th scope="col" className="py-2 pr-2 font-medium">
                Category
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Per month
              </th>
              <th scope="col" className="py-2 pr-2 font-medium">
                Share
              </th>
              <th scope="col" className="hidden w-1/4 py-2 font-medium sm:table-cell">
                <span className="sr-only">Bar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(v.categories[c] ?? []).map((r) => (
              <tr key={r.category} className="border-t border-border align-middle">
                <th scope="row" className="min-h-11 py-3 pr-2 font-normal [overflow-wrap:anywhere]">
                  {r.category}
                </th>
                <td className="py-3 pr-2 tabular-nums">{formatMoney(r.monthlyMinor, c)}</td>
                <td className="py-3 pr-2 tabular-nums">{r.percent}%</td>
                <td className="hidden py-3 sm:table-cell" aria-hidden="true">
                  <div className="h-3 rounded-sm border border-primary">
                    <div className="h-full bg-primary" style={{ width: `${r.percent}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}

export default async function Dashboard() {
  const userId = userIdFrom(await getClaims());
  const supabase = userId ? await createClient() : null;
  const v =
    userId && supabase ? await loadDashboard(createSubDb(supabase), userId, new Date()) : "error";
  // A read error shows no card.
  const ask =
    userId && supabase && v !== "error" && v.total > 0
      ? await hasAnswered(supabase as unknown as FeedbackDb, userId).then(
          (a) => !a,
          () => false,
        )
      : false;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Dashboard</h1>
      {v === "error" ? (
        <p role="alert" className="mt-8 text-destructive">
          Your dashboard could not be loaded. Reload the page to try again.
        </p>
      ) : v.total === 0 ? (
        <AddCta text="Add your first subscription to set a stop date." />
      ) : (
        <>
          {v.counted === 0 ? <AddCta text="No active subscriptions." /> : <Counted v={v} />}
          {ask && <CardInterest />}
          <Nudge n={v.counted} />
          <Savings v={v} />
          {v.counted > 0 && <Categories v={v} />}
          <p className="mt-12 max-w-prose text-sm text-muted-foreground">{HONEST_NOTE}</p>
        </>
      )}
    </>
  );
}
