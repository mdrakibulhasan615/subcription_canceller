import Link from "next/link";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { createSubDb, userIdFrom } from "../../../lib/subscriptions";

export const metadata = { title: "Subscriptions" };

// T-007 replaces this file in full.
export default async function SubscriptionsPage() {
  const userId = userIdFrom(await getClaims());
  const subs = userId
    ? await createSubDb(await createClient())
        .listSubNames(userId)
        .catch(() => null)
    : null;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Subscriptions</h1>
      <Link
        href="/app/subscriptions/new"
        className="mt-6 inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:opacity-90"
      >
        Add subscription
      </Link>
      {subs === null ? (
        <p className="mt-8 text-destructive">
          Your subscriptions could not be loaded. Reload the page to try again.
        </p>
      ) : subs.length === 0 ? (
        <p className="mt-8 max-w-prose text-lg text-muted-foreground">
          You have no subscriptions yet. Add one to set a stop date.
        </p>
      ) : (
        <ul className="mt-8 flex max-w-prose flex-col gap-2">
          {subs.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {s.name}
                {s.archived_at && <span className="text-muted-foreground"> (Archived)</span>}
              </span>
              <Link
                href={`/app/subscriptions/${s.id}/edit`}
                aria-label={`Edit ${s.name}`}
                className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium underline underline-offset-4"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
