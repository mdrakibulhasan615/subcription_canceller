import { describe, expect, it, vi } from "vitest";
import { evaluateFacts, runSweep, type SweepDb, type SweepFacts, type SweepSub } from "./sweep";
import type { ExistingReminder, ReminderSubInput, ReminderWrites } from "./reminders";

const now = new Date("2026-12-01T00:00:00Z");

const goodFacts = (): SweepFacts => ({
  overduePending: { count: 0, ids: [] },
  failedRecent: { count: 0, ids: [] },
  sentNoProof: { count: 0, ids: [] },
  vault: { project_url: true, reminder_cron_secret: true },
  cron: { installed: true, jobActive: true, lastRunAt: "2026-11-30T23:58:00Z", failedRuns1h: 0 },
  http: { badResponses: 0 },
});

const baseSub: ReminderSubInput = {
  stopDate: null,
  nextRenewalDate: null,
  isTrial: false,
  trialEndDate: null,
  stopConfirmedAt: null,
  merchantCancelledAt: null,
  archivedAt: null,
};

const mk = (
  id: string,
  sub: Partial<ReminderSubInput>,
  existing: ExistingReminder[] = [],
  timezone = "UTC",
): SweepSub => ({
  id,
  userId: "u-" + id,
  sub: { ...baseSub, ...sub },
  profile: { timezone, reminderDays: [7, 3, 1] },
  existing,
});

const setup = (subs: SweepSub[], facts: SweepFacts = goodFacts()) => {
  const db = {
    facts: vi.fn(async () => facts),
    listActiveSubs: vi.fn(async () => subs),
    apply: vi.fn<(w: ReminderWrites) => Promise<void>>(async () => {}),
  } satisfies SweepDb;
  const alerter = { alert: vi.fn(async () => {}) };
  return { db, alerter };
};

const codes = (r: { findings: { code: string }[] }) => r.findings.map((f) => f.code);

describe("runSweep", () => {
  it("1: inserts missing 7/3/1 rows for both channels", async () => {
    const { db, alerter } = setup([mk("s1", { stopDate: "2026-12-11" })]);
    const r = await runSweep({ db, alerter, now });
    expect(db.apply).toHaveBeenCalledTimes(1);
    const w = db.apply.mock.calls[0]![0];
    expect(w.insert).toHaveLength(6);
    expect(new Set(w.insert.map((i) => i.channel))).toEqual(new Set(["in_app", "email"]));
    expect(codes(r)).toContain("repaired");
    expect(r.repaired).toBe(6);
  });

  it("2: nothing to repair means no apply, no findings, no alert", async () => {
    const first = setup([mk("s1", { stopDate: "2026-12-11" })]);
    await runSweep({ ...first, now });
    const existing: ExistingReminder[] = first.db.apply.mock.calls[0]![0].insert.map((i, n) => ({
      id: "r" + n,
      type: i.type,
      channel: i.channel,
      fireAt: i.fire_at,
      status: "pending",
    }));
    const { db, alerter } = setup([mk("s1", { stopDate: "2026-12-11" }, existing)]);
    const r = await runSweep({ db, alerter, now });
    expect(db.apply).not.toHaveBeenCalled();
    expect(r.findings).toEqual([]);
    expect(alerter.alert).not.toHaveBeenCalled();
  });

  it("3: renewal only and trial end get their rows", async () => {
    const { db, alerter } = setup([
      mk("ren", { nextRenewalDate: "2026-12-10" }),
      mk("trial", { isTrial: true, trialEndDate: "2026-12-10" }),
    ]);
    await runSweep({ db, alerter, now });
    const [a, b] = db.apply.mock.calls.map((c) => c[0]);
    expect(a!.insert.map((i) => i.type)).toEqual(["renewal", "renewal"]);
    expect(a!.insert[0]!.fire_at).toBe("2026-12-09T09:00:00.000Z");
    expect(new Set(b!.insert.map((i) => i.type))).toEqual(new Set(["trial_end"]));
    expect(b!.insert).toHaveLength(6);
  });

  it("4: archived sub skips pending rows, skipped row wanted again is reopened", async () => {
    const pending: ExistingReminder = {
      id: "p1",
      type: "stop_date",
      channel: "email",
      fireAt: "2026-12-04T09:00:00.000Z",
      status: "pending",
    };
    const archived = mk("a", { stopDate: "2026-12-11", archivedAt: "2026-11-20T00:00:00Z" }, [
      pending,
    ]);
    const skipped = mk("b", { stopDate: "2026-12-11" }, [
      { ...pending, id: "k1", status: "skipped" },
    ]);
    const { db, alerter } = setup([archived, skipped]);
    await runSweep({ db, alerter, now });
    expect(db.apply.mock.calls[0]![0].skipIds).toEqual(["p1"]);
    expect(db.apply.mock.calls[1]![0].reopenIds).toEqual(["k1"]);
  });

  it("5: stop date with all fire times past gives an info finding and no insert", async () => {
    const { db, alerter } = setup([mk("late", { stopDate: "2026-12-01" })]);
    const r = await runSweep({ db, alerter, now });
    expect(db.apply).not.toHaveBeenCalled();
    expect(r.repaired).toBe(0);
    const f = r.findings.find((x) => x.code === "late_stop_date_no_reminder");
    expect(f?.severity).toBe("info");
    expect(codes(r)).not.toContain("repaired");
  });

  it("8: throwing alerter still resolves with findings", async () => {
    const { db } = setup([], { ...goodFacts(), overduePending: { count: 1, ids: ["x"] } });
    const alerter = {
      alert: vi.fn(async () => {
        throw new Error("mail down");
      }),
    };
    const r = await runSweep({ db, alerter, now });
    expect(codes(r)).toEqual(["overdue_pending", "alert_failed"]);
  });

  it("8: throwing listActiveSubs and facts give critical findings", async () => {
    const { db, alerter } = setup([]);
    db.listActiveSubs.mockRejectedValue(new Error("db down"));
    db.facts.mockRejectedValue(new Error("rpc down"));
    const r = await runSweep({ db, alerter, now });
    expect(codes(r)).toEqual(["list_subs_failed", "sweep_facts_failed"]);
    expect(r.findings.every((f) => f.severity === "critical")).toBe(true);
    expect(alerter.alert).toHaveBeenCalledTimes(1);
  });

  it("9: bad timezone on one profile does not stop the others", async () => {
    const { db, alerter } = setup([
      mk("bad", { stopDate: "2026-12-11" }, [], "Nowhere/Land"),
      mk("good", { stopDate: "2026-12-11" }),
    ]);
    const r = await runSweep({ db, alerter, now });
    expect(r.findings.find((f) => f.code === "bad_profile")?.detail).toContain("bad");
    expect(r.findings.find((f) => f.code === "bad_profile")?.severity).toBe("critical");
    expect(db.apply).toHaveBeenCalledTimes(1);
    expect(db.apply.mock.calls[0]![0].insert[0]!.subscription_id).toBe("good");
  });

  it("an apply failure becomes a finding and the loop goes on", async () => {
    const { db, alerter } = setup([
      mk("one", { stopDate: "2026-12-11" }),
      mk("two", { stopDate: "2026-12-11" }),
    ]);
    db.apply.mockRejectedValueOnce(new Error("boom"));
    const r = await runSweep({ db, alerter, now });
    expect(db.apply).toHaveBeenCalledTimes(2);
    expect(codes(r)).toContain("apply_failed");
    expect(r.findings.find((f) => f.code === "apply_failed")?.severity).toBe("critical");
    expect(r.repaired).toBe(6);
  });

  it("uses 9 as send hour when the profile has none", async () => {
    const { db, alerter } = setup([mk("s", { nextRenewalDate: "2026-12-10" })]);
    await runSweep({ db, alerter, now });
    expect(db.apply.mock.calls[0]![0].insert[0]!.fire_at).toContain("T09:00:00");
  });
});

describe("evaluateFacts", () => {
  it("all good gives none", () => {
    expect(evaluateFacts(goodFacts(), now)).toEqual([]);
  });

  it("6: row counts give critical findings", () => {
    const f = {
      ...goodFacts(),
      overduePending: { count: 2, ids: ["a"] },
      failedRecent: { count: 1, ids: ["b"] },
      sentNoProof: { count: 3, ids: ["c"] },
    };
    const out = evaluateFacts(f, now);
    expect(out.map((x) => x.code)).toEqual([
      "overdue_pending",
      "failed_reminders",
      "sent_no_proof",
    ]);
    expect(out.map((x) => x.count)).toEqual([2, 1, 3]);
    expect(out.every((x) => x.severity === "critical")).toBe(true);
  });

  it("7: each infra problem has its own critical finding", () => {
    const cases: [(f: SweepFacts) => void, string][] = [
      [(f) => (f.vault.project_url = false), "vault_project_url_missing"],
      [(f) => (f.vault.reminder_cron_secret = false), "vault_cron_secret_missing"],
      [(f) => (f.cron.jobActive = false), "cron_job_inactive"],
      [(f) => (f.cron.installed = false), "cron_not_installed"],
      [(f) => (f.cron.failedRuns1h = 2), "cron_runs_failed"],
      [(f) => (f.cron.lastRunAt = "2026-11-30T23:30:00Z"), "cron_stale"],
      [(f) => (f.cron.lastRunAt = null), "cron_stale"],
      [(f) => (f.http.badResponses = 1), "http_bad_responses"],
    ];
    for (const [mutate, code] of cases) {
      const f = goodFacts();
      mutate(f);
      const out = evaluateFacts(f, now);
      expect(out.map((x) => x.code)).toContain(code);
      expect(out.every((x) => x.severity === "critical")).toBe(true);
    }
  });
});
