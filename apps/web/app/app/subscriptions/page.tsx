import Link from "next/link";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { createSubDb, userIdFrom } from "../../../lib/subscriptions";
import {
  STATUSES,
  daysLeftText,
  formatDate,
  loadList,
  type ListParams,
} from "../../../lib/sub-view";
import { StatusBadge } from "./status-badge";

export const metadata = { title: "Subscriptions" };

const STATUS_LABEL = {
  active: "Active",
  stopping_soon: "Stopping soon",
  stopped: "Stopped",
  cancelled: "Cancelled with merchant",
} as const;

const btn =
  "inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:opacity-90";
const secondary =
  "inline-flex h-11 items-center rounded-md border border-input px-4 font-medium text-foreground hover:bg-accent";
const chip =
  "inline-flex min-h-11 items-center rounded-md border border-input px-3 text-sm aria-[current=true]:border-primary aria-[current=true]:font-semibold";

function href(
  p: ListParams,
  o: Partial<{ status: string | null; sort: string; archived: boolean }>,
) {
  const q = new URLSearchParams();
  const status = "status" in o ? o.status : p.status;
  const sort = o.sort ?? p.sort;
  const archived = o.archived ?? p.archived;
  if (status) q.set("status", status);
  if (sort !== "next") q.set("sort", sort);
  if (archived) q.set("archived", "1");
  const s = q.toString();
  return s ? `/app/subscriptions?${s}` : "/app/subscriptions";
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const userId = userIdFrom(await getClaims());
  const view = userId
    ? await loadList(createSubDb(await createClient()), userId, sp, new Date())
    : "error";
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Subscriptions</h1>
      {view === "error" ? (
        <p role="alert" className="mt-8 text-destructive">
          Your subscriptions could not be loaded. Reload the page to try again.
        </p>
      ) : view.total === 0 ? (
        <>
          <p className="mt-8 max-w-prose text-lg text-muted-foreground">
            Add your first subscription to set a stop date.
          </p>
          <Link href="/app/subscriptions/new" className={`mt-6 ${btn}`}>
            Add subscription
          </Link>
          <Link href="/app/import" className={`mt-6 ml-3 ${secondary}`}>
            Import from CSV
          </Link>
        </>
      ) : (
        <>
          <Link href="/app/subscriptions/new" className={`mt-6 ${btn}`}>
            Add subscription
          </Link>
          <Link href="/app/import" className={`mt-6 ml-3 ${secondary}`}>
            Import from CSV
          </Link>
          <nav aria-label="Filter and sort" className="mt-6 flex flex-col gap-3">
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={href(view.params, { status: null })}
                  aria-current={view.params.status === null}
                  className={chip}
                >
                  All
                </Link>
              </li>
              {STATUSES.map((s) => (
                <li key={s}>
                  <Link
                    href={href(view.params, { status: s })}
                    aria-current={view.params.status === s}
                    className={chip}
                  >
                    {STATUS_LABEL[s]}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={href(view.params, { sort: "next" })}
                  aria-current={view.params.sort === "next"}
                  className={chip}
                >
                  Soonest first
                </Link>
              </li>
              <li>
                <Link
                  href={href(view.params, { sort: "name" })}
                  aria-current={view.params.sort === "name"}
                  className={chip}
                >
                  Name A to Z
                </Link>
              </li>
              <li>
                <Link
                  href={href(view.params, { archived: !view.params.archived })}
                  aria-current={view.params.archived}
                  className={chip}
                >
                  Show archived
                </Link>
              </li>
            </ul>
          </nav>
          {view.rows.length === 0 ? (
            <div className="mt-8">
              <p className="text-lg text-muted-foreground">No subscriptions match this filter.</p>
              <Link href="/app/subscriptions" className={`mt-4 ${btn}`}>
                Clear filter
              </Link>
            </div>
          ) : (
            <ul className="mt-8 flex flex-col gap-4">
              {view.rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
                >
                  <Link
                    href={`/app/subscriptions/${r.id}`}
                    className="flex flex-col gap-2 rounded-md break-words"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xl font-semibold [overflow-wrap:anywhere]">
                        {r.name}
                      </span>
                      <StatusBadge status={r.status} />
                      {r.archived && (
                        <span className="text-sm text-muted-foreground">Archived</span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      {r.priceText} · {r.cycleText} · {r.monthlyText}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Next renewal: {formatDate(r.nextRenewal)} · Stop date:{" "}
                      {formatDate(r.stopDate)} · Days left: {daysLeftText(r.daysLeft, !!r.stopDate)}
                    </span>
                  </Link>
                  <Link
                    href={`/app/subscriptions/${r.id}/edit`}
                    aria-label={`Edit ${r.name}`}
                    className="inline-flex min-h-11 w-fit items-center rounded-md px-3 text-sm font-medium underline underline-offset-4"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
