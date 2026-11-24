import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "./subscriptions";

export interface NotificationSub {
  name: string;
  stop_date: string | null;
  next_renewal_date: string | null;
  trial_end_date: string | null;
}
export interface Notification {
  id: string;
  text: string;
  fireAt: string;
  unread: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : iso;
};

/** Badge text for the nav. Over 9 shows "9+". */
export const formatBadge = (n: number) => (n > 9 ? "9+" : String(n));

/** Same sentences as the email, shorter. The date is the one the reminder is about. "Today" is in the user timezone. */
export function notificationText(
  type: string,
  sub: NotificationSub,
  now: Date,
  tz = "UTC",
): string {
  const key =
    type === "stop_date"
      ? sub.stop_date
      : type === "renewal"
        ? sub.next_renewal_date
        : type === "trial_end"
          ? sub.trial_end_date
          : null;
  const d = key ? formatDate(key) : "";
  const lead = !key
    ? "Check this subscription."
    : key < todayIn(tz, now)
      ? `The date was ${d}.`
      : type === "renewal"
        ? `${sub.name} renews on ${d}. To stop payments, freeze or close your card a few days before this date.`
        : type === "trial_end"
          ? `The free trial ends on ${d}. Payments can start on that date.`
          : `Payments stop on ${d}.`;
  return `${sub.name}: ${lead} Freeze or close your card a few days before the renewal date. Blocking a card does not cancel the subscription.`;
}

interface Row {
  id: string;
  type: string;
  fire_at: string;
  read_at: string | null;
  subscriptions: NotificationSub | NotificationSub[] | null;
}

/** Sent in-app reminders, newest first. RLS limits rows to the signed-in user. Throws on error. */
export async function listNotifications(
  sb: SupabaseClient,
  now = new Date(),
  tz = "UTC",
): Promise<Notification[]> {
  const { data, error } = await sb
    .from("reminders")
    .select(
      "id, type, fire_at, read_at, subscriptions(name, stop_date, next_renewal_date, trial_end_date)",
    )
    .eq("channel", "in_app")
    .eq("status", "sent")
    .order("fire_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).flatMap((r) => {
    const sub = Array.isArray(r.subscriptions) ? r.subscriptions[0] : r.subscriptions;
    if (!sub) return [];
    return [
      {
        id: r.id,
        text: notificationText(r.type, sub, now, tz),
        fireAt: r.fire_at,
        unread: r.read_at === null,
      },
    ];
  });
}

/** Unread count for the nav badge. 0 on any error, so the layout never breaks. */
export async function unreadCount(sb: SupabaseClient): Promise<number> {
  try {
    const { count, error } = await sb
      .from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("channel", "in_app")
      .eq("status", "sent")
      .is("read_at", null);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

/** Marks rows read. Rows already read stay as they are. Throws on error. */
export async function markRead(sb: SupabaseClient, ids: string[] | "all", now = new Date()) {
  if (ids !== "all" && ids.length === 0) return;
  let q = sb
    .from("reminders")
    .update({ read_at: now.toISOString() })
    .eq("channel", "in_app")
    .eq("status", "sent")
    .is("read_at", null);
  if (ids !== "all") q = q.in("id", ids);
  const { error } = await q;
  if (error) throw error;
}
