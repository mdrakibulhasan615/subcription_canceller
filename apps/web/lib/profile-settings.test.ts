import { describe, expect, it } from "vitest";
import {
  saveProfileSettings,
  type DbLike,
  type NewReminder,
  type ReminderRow,
  type SubRow,
} from "./profile-settings";

const NOW = new Date("2026-11-24T00:00:00Z");
const USER = "u1";
const input = {
  display_name: "Sam",
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  default_stop_days_before: 3,
  reminder_days: [7, 3, 1],
  reminder_hour: 9,
  email_reminders: true,
};
const sub = (id: string, stop: string): SubRow => ({
  id,
  stop_date: stop,
  next_renewal_date: stop,
  is_trial: false,
  trial_end_date: null,
  stop_confirmed_at: null,
  merchant_cancelled_at: null,
  archived_at: null,
});

function fake(opts: {
  subs?: SubRow[];
  reminders?: ReminderRow[];
  failProfile?: boolean;
  insertCode?: string | null;
}) {
  const calls: string[] = [];
  const inserts: NewReminder[] = [];
  const statusUpdates: { ids: string[]; to: string }[] = [];
  const db: DbLike = {
    async getProfile() {
      calls.push("getProfile");
      return null;
    },
    async updateProfile() {
      calls.push("updateProfile");
      if (opts.failProfile) throw new Error("x");
    },
    async listSubsWithReminders() {
      calls.push("list");
      return { subs: opts.subs ?? [], reminders: opts.reminders ?? [] };
    },
    async insertReminder(r) {
      calls.push("insert");
      inserts.push(r);
      return opts.insertCode ?? null;
    },
    async setReminderStatus(ids, to) {
      calls.push(`status:${to}`);
      statusUpdates.push({ ids, to });
    },
  };
  return { db, calls, inserts, statusUpdates };
}

const row = (
  id: string,
  sid: string,
  fire: string,
  status: "pending" | "skipped" = "pending",
  type: ReminderRow["type"] = "stop_date",
  channel: ReminderRow["channel"] = "email",
): ReminderRow => ({ id, subscription_id: sid, type, channel, fire_at: fire, status });

describe("saveProfileSettings", () => {
  it("W1 timezone change inserts at 09:00 MYT and skips old pending rows", async () => {
    const f = fake({
      subs: [sub("s1", "2026-12-20"), sub("s2", "2026-12-25")],
      reminders: [row("r1", "s1", "2026-12-13T09:00:00Z"), row("r2", "s2", "2026-12-18T09:00:00Z")],
    });
    expect(await saveProfileSettings(f.db, USER, input, NOW)).toEqual({ ok: true });
    expect(f.inserts.some((r) => r.fire_at === "2026-12-13T01:00:00.000Z")).toBe(true);
    const skipped = f.statusUpdates.filter((u) => u.to === "skipped").flatMap((u) => u.ids);
    expect(skipped).toEqual(expect.arrayContaining(["r1", "r2"]));
    expect(f.calls.indexOf("insert")).toBeLessThan(f.calls.indexOf("status:skipped"));
  });

  it("W2 when rows already match, nothing is written", async () => {
    const subs = [sub("s1", "2026-12-20")];
    const first = fake({ subs });
    await saveProfileSettings(first.db, USER, input, NOW);
    const reminders = first.inserts.map((r, i) =>
      row(`r${i}`, "s1", r.fire_at, "pending", r.type, r.channel),
    );
    const g = fake({ subs, reminders });
    await saveProfileSettings(g.db, USER, input, NOW);
    expect(g.inserts).toEqual([]);
    expect(g.statusUpdates).toEqual([]);
  });

  it("W3 a skipped row that is wanted again is reopened, not inserted", async () => {
    const subs = [sub("s1", "2026-12-20")];
    const first = fake({ subs });
    await saveProfileSettings(first.db, USER, input, NOW);
    const one = first.inserts[0]!;
    const g = fake({
      subs,
      reminders: [row("r0", "s1", one.fire_at, "skipped", one.type, one.channel)],
    });
    await saveProfileSettings(g.db, USER, input, NOW);
    expect(g.statusUpdates).toContainEqual({ ids: ["r0"], to: "pending" });
    expect(g.inserts.some((r) => r.fire_at === one.fire_at && r.channel === one.channel)).toBe(
      false,
    );
  });

  it("W4 invalid input makes no db call and names the fields", async () => {
    const f = fake({});
    const r = await saveProfileSettings(
      f.db,
      USER,
      { ...input, reminder_hour: 24, timezone: "Mars/Base" },
      NOW,
    );
    expect(f.calls).toEqual([]);
    expect(r).toMatchObject({
      ok: false,
      fieldErrors: { reminder_hour: expect.any(String), timezone: expect.any(String) },
    });
  });

  it("W5 profile error is server; insert error is rebuild_failed; 23505 is fine", async () => {
    const a = fake({ failProfile: true });
    expect(await saveProfileSettings(a.db, USER, input, NOW)).toEqual({
      ok: false,
      error: "server",
    });
    expect(a.calls).not.toContain("list");

    const subs = [sub("s1", "2026-12-20")];
    const b = fake({ subs, insertCode: "42501" });
    expect(await saveProfileSettings(b.db, USER, input, NOW)).toEqual({
      ok: false,
      error: "rebuild_failed",
    });
    expect(b.calls).toContain("updateProfile");

    const c = fake({ subs, insertCode: "23505" });
    expect(await saveProfileSettings(c.db, USER, input, NOW)).toEqual({ ok: true });
  });
});
