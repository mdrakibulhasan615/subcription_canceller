import { z } from "zod";

export const EVENT_NAMES = [
  "signed_in_first",
  "onboarding_completed",
  "onboarding_skipped",
  "subscription_added",
  "subscription_stop_confirmed",
  "merchant_cancelled_marked",
  "stop_date_extended",
  "csv_imported",
  "export_downloaded",
  "account_deleted",
  "waitlist_joined",
  "app_opened",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const PAYMENT_TYPES = ["none", "wise", "privacy", "other_virtual"] as const;

const none = z.object({}).strict();
// Only enums, booleans and small numbers. Never an email, name, price, card or note.
const SCHEMAS: Record<EventName, z.ZodType> = {
  signed_in_first: none,
  onboarding_completed: none,
  onboarding_skipped: none,
  subscription_added: z
    .object({
      has_stop_date: z.boolean(),
      is_trial: z.boolean(),
      payment_method_type: z.enum(PAYMENT_TYPES),
      source: z.enum(["form", "csv"]),
    })
    .strict(),
  subscription_stop_confirmed: none,
  merchant_cancelled_marked: none,
  stop_date_extended: none,
  csv_imported: z.object({ count: z.number().int().min(0).max(500) }).strict(),
  export_downloaded: z.object({ format: z.enum(["json", "csv"]) }).strict(),
  account_deleted: none,
  waitlist_joined: none,
  app_opened: none,
};

export type EventsClient = {
  from: (table: "events") => {
    insert: (row: {
      user_id: string | null;
      name: string;
      props: unknown;
    }) => PromiseLike<{ error: unknown }>;
  };
};

/** Never throws or rejects. A bad prop set or a failed insert drops the event. */
export async function trackEvent(
  client: EventsClient,
  userId: string | null,
  name: EventName,
  props: unknown = {},
): Promise<void> {
  try {
    const schema = SCHEMAS[name];
    const parsed = schema?.safeParse(props);
    if (!parsed?.success) {
      console.warn(`event dropped: ${name}`);
      return;
    }
    const { error } = await client
      .from("events")
      .insert({ user_id: userId, name, props: parsed.data });
    // 23505 on app_opened = already counted today. Not worth a warning.
    if (error && (error as { code?: string }).code !== "23505")
      console.warn(`event failed: ${name}`);
  } catch {
    console.warn(`event failed: ${name}`);
  }
}
