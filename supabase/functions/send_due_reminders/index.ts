// Deno glue. Not unit tested. Logic lives in handler.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleRequest,
  runDueReminders,
  type ClaimedReminder,
  type SenderDb,
} from "./handler.ts";
import { createResendTransport } from "./resend.ts";
import { alertFounder, emailReminderSender, inAppSender, stubEmailSender } from "./senders.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const db: SenderDb = {
  async claim(batch) {
    const { data, error } = await supabase.rpc("claim_due_reminders", { batch });
    if (error) throw new Error(error.message);
    return (data ?? []).map(
      (d: Record<string, unknown>): ClaimedReminder => ({
        id: d.id as string,
        subscriptionId: d.subscription_id as string,
        userId: d.user_id as string,
        type: d.type as string,
        channel: d.channel as string,
        userEmail: (d.user_email as string | null) ?? null,
        subName: d.sub_name as string,
        subInactive: d.sub_inactive as boolean,
        attempts: d.attempts as number,
        fireAt: d.fire_at as string,
        cancelUrl: (d.cancel_url as string | null) ?? null,
        priceMinor: d.price_minor as number,
        currency: d.currency as string,
        timezone: d.timezone as string,
        stopDate: (d.stop_date as string | null) ?? null,
        nextRenewalDate: (d.next_renewal_date as string | null) ?? null,
        trialEndDate: (d.trial_end_date as string | null) ?? null,
        emailReminders: d.email_reminders !== false,
      }),
    );
  },
  async mark(id, outcome, err, ref) {
    const { data, error } = await supabase.rpc("mark_reminder_result", {
      p_id: id,
      p_outcome: outcome,
      p_error: err ?? null,
      p_ref: ref ?? null,
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

// Without a key, a sender address and an https APP_URL the stub makes email rows fail with "email not configured".
const apiKey = Deno.env.get("RESEND_API_KEY");
const from = Deno.env.get("EMAIL_FROM");
const appUrl = Deno.env.get("APP_URL") ?? "";
// Real email only when links will be https. Else the stub, so no mail has broken links.
const transport =
  apiKey && from && appUrl.startsWith("https://") ? createResendTransport({ apiKey, from }) : null;
const tpl = {
  appUrl,
  brand: Deno.env.get("APP_NAME") ?? "StopDate",
};

Deno.serve((req) =>
  handleRequest(req, Deno.env.get("CRON_SECRET"), () =>
    runDueReminders({
      db,
      senders: {
        in_app: inAppSender,
        email: transport ? emailReminderSender(transport, tpl) : stubEmailSender,
      },
      alerter: alertFounder(transport, Deno.env.get("FOUNDER_ALERT_EMAIL"), tpl),
    }),
  ),
);
