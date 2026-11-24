import { CircleAlert, Bell } from "lucide-react";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { createSubDb, userIdFrom } from "../../../lib/subscriptions";
import { listNotifications, type Notification } from "../../../lib/notifications";
import { Button } from "../../../components/ui/button";
import { markAllRead, markOneRead } from "./actions";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const userId = userIdFrom(await getClaims());
  let items: Notification[] = [];
  let failed = false;
  try {
    const sb = await createClient();
    // A profile error must not hide the notices: fall back to UTC.
    const tz = userId
      ? ((
          await createSubDb(sb)
            .getProfile(userId)
            .catch(() => null)
        )?.timezone ?? "UTC")
      : "UTC";
    items = await listNotifications(sb, new Date(), tz);
  } catch {
    failed = true;
  }
  const unread = items.filter((i) => i.unread).length;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Notifications</h1>
      {failed ? (
        <p className="mt-8 flex items-start gap-2 text-destructive">
          <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden="true" />
          Your notifications could not be loaded. Reload the page to try again.
        </p>
      ) : items.length === 0 ? (
        <p className="mt-8 max-w-prose text-lg text-muted-foreground">
          No reminders yet. They show here on the day they are due.
        </p>
      ) : (
        <>
          {unread > 0 && (
            <form action={markAllRead} className="mt-6">
              <Button type="submit" variant="outline">
                Mark all as read
              </Button>
            </form>
          )}
          <ul className="mt-6 flex max-w-prose flex-col gap-4">
            {items.map((n) => (
              <li
                key={n.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <p className="flex items-start gap-2">
                  {n.unread ? (
                    <>
                      <Bell className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="rounded-sm bg-secondary px-2 text-xs leading-6 font-semibold">
                        Unread
                      </span>
                    </>
                  ) : null}
                  <span>{n.text}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  <time dateTime={n.fireAt} className="tabular-nums">
                    {n.fireAt.slice(0, 10)}
                  </time>
                </p>
                {n.unread && (
                  <form action={markOneRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <Button type="submit" variant="ghost" size="sm" className="min-h-11">
                      Mark read
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
