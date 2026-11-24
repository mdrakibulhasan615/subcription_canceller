// Deno glue. Not unit tested. Logic lives in handler.ts.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  handleRequest,
  runDueReminders,
  type ClaimedReminder,
  type SenderDb,
} from "./handler.ts";
import { alertFounder, inAppSender, stubEmailSender } from "./senders.ts";

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
        userId: d.user_id as string,
        type: d.type as string,
        channel: d.channel as string,
        userEmail: (d.user_email as string | null) ?? null,
        subName: d.sub_name as string,
        subInactive: d.sub_inactive as boolean,
        attempts: d.attempts as number,
        fireAt: d.fire_at as string,
      }),
    );
  },
  async mark(id, outcome, err) {
    const { data, error } = await supabase.rpc("mark_reminder_result", {
      p_id: id,
      p_outcome: outcome,
      p_error: err ?? null,
    });
    if (error) throw new Error(error.message);
    return data;
  },
};

Deno.serve((req) =>
  handleRequest(req, Deno.env.get("CRON_SECRET"), () =>
    runDueReminders({
      db,
      senders: { in_app: inAppSender, email: stubEmailSender },
      alerter: alertFounder(stubEmailSender, Deno.env.get("FOUNDER_ALERT_EMAIL")),
    }),
  ),
);
