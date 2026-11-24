import {
  desiredReminders,
  planReminders,
  reminderWrites,
  type ExistingReminder,
  type ReminderProfile,
  type ReminderSubInput,
  type ReminderWrites,
} from "./reminders";

export interface SweepSub {
  id: string;
  userId: string;
  sub: ReminderSubInput;
  profile: ReminderProfile;
  existing: ExistingReminder[];
}

interface IdCount {
  count: number;
  ids: string[];
}

export interface SweepFacts {
  overduePending: IdCount;
  failedRecent: IdCount;
  sentNoProof: IdCount;
  vault: { project_url: boolean; reminder_cron_secret: boolean };
  cron: { installed: boolean; jobActive: boolean; lastRunAt: string | null; failedRuns1h: number };
  http: { badResponses: number };
}

export interface Finding {
  code: string;
  severity: "info" | "warn" | "critical";
  detail: string;
  count?: number;
}

export interface SweepDb {
  facts(): Promise<SweepFacts>;
  listActiveSubs(): Promise<SweepSub[]>;
  apply(w: ReminderWrites): Promise<void>;
}

export interface SweepAlerter {
  alert(findings: Finding[]): Promise<void>;
}

const CRON_STALE_MS = 15 * 60 * 1000;

export function evaluateFacts(f: SweepFacts, now: Date): Finding[] {
  const out: Finding[] = [];
  const add = (code: string, detail: string, count?: number) =>
    out.push({ code, severity: "critical", detail, ...(count === undefined ? {} : { count }) });

  if (f.overduePending.count > 0) {
    add(
      "overdue_pending",
      "Pending reminders are more than 30 minutes late.",
      f.overduePending.count,
    );
  }
  if (f.failedRecent.count > 0) {
    add("failed_reminders", "Reminders failed in the last 7 days.", f.failedRecent.count);
  }
  if (f.sentNoProof.count > 0) {
    add("sent_no_proof", "Reminders marked sent have no proof of delivery.", f.sentNoProof.count);
  }
  if (!f.vault.project_url)
    add("vault_project_url_missing", "Vault secret project_url is missing.");
  if (!f.vault.reminder_cron_secret) {
    add("vault_cron_secret_missing", "Vault secret reminder_cron_secret is missing.");
  }
  if (!f.cron.installed) {
    add("cron_not_installed", "pg_cron is not installed.");
  } else {
    if (!f.cron.jobActive) add("cron_job_inactive", "Job send_due_reminders is missing or off.");
    if (f.cron.failedRuns1h > 0) {
      add("cron_runs_failed", "Cron runs failed in the last hour.", f.cron.failedRuns1h);
    }
    const last = f.cron.lastRunAt ? new Date(f.cron.lastRunAt).getTime() : NaN;
    if (!(now.getTime() - last <= CRON_STALE_MS)) {
      add("cron_stale", `Last cron run: ${f.cron.lastRunAt ?? "never"}.`);
    }
  }
  if (f.http.badResponses > 0) {
    add(
      "http_bad_responses",
      "The sender returned errors in the last 6 hours.",
      f.http.badResponses,
    );
  }
  return out;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runSweep(deps: {
  db: SweepDb;
  alerter: SweepAlerter;
  now?: Date;
}): Promise<{ repaired: number; findings: Finding[] }> {
  const { db, alerter } = deps;
  const now = deps.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const findings: Finding[] = [];
  let repaired = 0;

  let subs: SweepSub[] = [];
  try {
    subs = await db.listActiveSubs();
  } catch (e) {
    findings.push({ code: "list_subs_failed", severity: "critical", detail: msg(e) });
  }

  for (const s of subs) {
    let writes: ReminderWrites;
    try {
      const profile = { ...s.profile, sendHour: s.profile.sendHour ?? 9 };
      writes = reminderWrites(planReminders(s.sub, profile, s.existing, now), s.id, s.userId);
      const { stopDate, nextRenewalDate } = s.sub;
      const inactive = s.sub.archivedAt || s.sub.stopConfirmedAt || s.sub.merchantCancelledAt;
      if (
        stopDate &&
        stopDate >= today &&
        !inactive &&
        !(nextRenewalDate && stopDate > nextRenewalDate) &&
        !s.existing.some((r) => r.type === "stop_date") &&
        !desiredReminders(s.sub, profile, now).some((r) => r.type === "stop_date")
      ) {
        findings.push({
          code: "late_stop_date_no_reminder",
          severity: "info",
          detail: `Sub ${s.id}: stop date ${stopDate} is too close for any reminder.`,
        });
      }
    } catch (e) {
      findings.push({
        code: "bad_profile",
        severity: "critical",
        detail: `Sub ${s.id}: ${msg(e)}`,
      });
      continue;
    }

    const n = writes.insert.length + writes.skipIds.length + writes.reopenIds.length;
    if (n === 0) continue;
    try {
      await db.apply(writes);
      repaired += n;
    } catch (e) {
      findings.push({
        code: "apply_failed",
        severity: "critical",
        detail: `Sub ${s.id}: ${msg(e)}`,
      });
    }
  }

  if (repaired > 0) {
    findings.push({
      code: "repaired",
      severity: "warn",
      detail: "The sweep fixed reminder rows that were missing or stale.",
      count: repaired,
    });
  }

  try {
    findings.push(...evaluateFacts(await db.facts(), now));
  } catch (e) {
    findings.push({ code: "sweep_facts_failed", severity: "critical", detail: msg(e) });
  }

  if (findings.length > 0) {
    try {
      await alerter.alert(findings);
    } catch (e) {
      findings.push({ code: "alert_failed", severity: "critical", detail: msg(e) });
    }
  }
  return { repaired, findings };
}
