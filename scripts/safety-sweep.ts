// Glue for the daily safety sweep. Not unit tested. Logic lives in packages/core/src/sweep.ts.
import { createClient } from "@supabase/supabase-js";
import {
  runSweep,
  type ExistingReminder,
  type Finding,
  type SweepDb,
  type SweepFacts,
  type SweepSub,
} from "../packages/core/src/index";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const PAGE = 1000;

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const db: SweepDb = {
  async facts() {
    const { data, error } = await supabase.rpc("sweep_facts");
    if (error) throw new Error(error.message);
    return data as SweepFacts;
  },

  async listActiveSubs() {
    const cutoff = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const out: SweepSub[] = [];
    for (let from = 0; ; from += PAGE) {
      // Inactive subs are included on purpose: the sweep skips their stale pending rows.
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, profiles(*), reminders(id, type, channel, fire_at, status)")
        .or(`stop_date.gte.${cutoff},next_renewal_date.gte.${cutoff},trial_end_date.gte.${cutoff}`)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as Row[]) {
        const p = r.profiles as Row | null;
        if (!p) continue;
        out.push({
          id: r.id,
          userId: r.user_id,
          sub: {
            stopDate: r.stop_date,
            nextRenewalDate: r.next_renewal_date,
            isTrial: r.is_trial,
            trialEndDate: r.trial_end_date,
            stopConfirmedAt: r.stop_confirmed_at,
            merchantCancelledAt: r.merchant_cancelled_at,
            archivedAt: r.archived_at,
          },
          // reminder_hour is added by T-004. Until then it is undefined and the sweep uses 9.
          profile: {
            timezone: p.timezone,
            reminderDays: p.reminder_days,
            sendHour: p.reminder_hour ?? undefined,
          },
          existing: (r.reminders as Row[]).map((x): ExistingReminder => ({
            id: x.id,
            type: x.type,
            channel: x.channel,
            fireAt: x.fire_at,
            status: x.status,
          })),
        });
      }
      if (!data || data.length < PAGE) return out;
    }
  },

  async apply(w) {
    if (w.insert.length > 0) {
      const { error } = await supabase.from("reminders").upsert(w.insert, {
        onConflict: "subscription_id,type,channel,fire_at",
        ignoreDuplicates: true,
      });
      if (error) throw new Error(error.message);
    }
    if (w.skipIds.length > 0) {
      const { error } = await supabase
        .from("reminders")
        .update({ status: "skipped" })
        .in("id", w.skipIds)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
    }
    if (w.reopenIds.length > 0) {
      const { error } = await supabase
        .from("reminders")
        .update({ status: "pending" })
        .in("id", w.reopenIds)
        .eq("status", "skipped");
      if (error) throw new Error(error.message);
    }
  },
};

// Stub until T-011: log the findings. A failed run makes GitHub email the owner.
const alerter = {
  async alert(findings: Finding[]) {
    console.error(JSON.stringify(findings, null, 2));
  },
};

// No top-level await: the root package is CommonJS.
runSweep({ db, alerter })
  .then(({ repaired, findings }) => {
    console.log(`Sweep done. Repaired: ${repaired}. Findings: ${findings.length}.`);
    process.exit(findings.some((f) => f.severity === "critical") ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
