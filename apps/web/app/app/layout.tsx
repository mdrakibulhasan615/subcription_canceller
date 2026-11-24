import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND } from "@app/core";
import { Button } from "../../components/ui/button";
import { createClient, getClaims } from "../../lib/supabase/server";
import { formatBadge, unreadCount } from "../../lib/notifications";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const claims = await getClaims();
  // The proxy is not the only gate.
  if (!claims) redirect("/sign-in?next=%2Fapp");
  const unread = await unreadCount(await createClient());
  return (
    <>
      <a
        href="#main"
        className="absolute -top-20 left-4 z-100 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:top-4"
      >
        Skip to main content
      </a>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 lg:px-8">
        <span className="text-lg font-semibold">{BRAND}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm break-all text-muted-foreground">
            {typeof claims.email === "string" ? claims.email : ""}
          </span>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" className="min-h-11">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <nav aria-label="Main" className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">
        <Link
          href="/app/subscriptions"
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium underline-offset-4 hover:underline"
        >
          Subscriptions
        </Link>
        <Link
          href="/app/settings"
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium underline-offset-4 hover:underline"
        >
          Settings
        </Link>
        <Link
          href="/app/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : undefined}
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium underline-offset-4 hover:underline"
        >
          Notifications
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="rounded-sm bg-primary px-2 text-xs leading-6 font-semibold text-primary-foreground"
            >
              {formatBadge(unread)}
            </span>
          )}
        </Link>
      </nav>
      <main id="main" className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">
        {children}
      </main>
    </>
  );
}
