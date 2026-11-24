import Link from "next/link";

const btn =
  "inline-flex h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground hover:opacity-90";

export function Nudge({ n }: { n: number }) {
  if (n !== 1 && n !== 2) return null;
  return (
    <aside
      aria-labelledby="nudge-h"
      className="mt-8 max-w-prose rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="nudge-h" className="text-xl font-semibold">
        Add the rest
      </h2>
      <p className="mt-2">
        You have {n} of 3 subscriptions. Most people have more. Add the rest so your totals and
        reminders are complete.
      </p>
      <p className="mt-4 flex flex-wrap gap-4">
        <Link href="/app/subscriptions/new" className={btn}>
          Add subscription
        </Link>
        <Link
          href="/app/import"
          className="inline-flex h-11 items-center rounded-md border border-input px-4 font-medium"
        >
          Import CSV
        </Link>
      </p>
    </aside>
  );
}
