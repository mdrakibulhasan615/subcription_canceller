import { describe, expect, it } from "vitest";
import type { ProfileSettings } from "@app/core";
import type { ReminderRow, SubRow } from "./profile-settings";
import {
  extendStopDate,
  markMerchantCancelled,
  markStopped,
  unmarkMerchantCancelled,
  unmarkStopped,
} from "./sub-actions";
import type { SubDb } from "./subscriptions";

const NOW = new Date("2026-11-25T02:00:00Z");
const USER = "u1";
const ID = "s1";
const profile: ProfileSettings = {
  display_name: null,
  timezone: "UTC",
  currency: "MYR",
  default_stop_days_before: 3,
  reminder_days: [7, 3, 1],
  reminder_hour: 9,
  email_reminders: true,
};

function fake(o: { failInserts?: boolean; renewal?: string | null } = {}) {
  const sub: SubRow & { user_id: string } = {
    id: ID,
    user_id: USER,
    stop_date: "2026-12-17",
    next_renewal_date: o.renewal === undefined ? "2026-12-20" : o.renewal,
    is_trial: false,
    trial_end_date: null,
    stop_confirmed_at: null,
    merchant_cancelled_at: null,
    archived_at: null,
  };
  const reminders: ReminderRow[] = [];
  let seq = 0;
  const patches: unknown[] = [];
  const db = {
    async getProfile() {
      return profile;
    },
    async getSub(u: string, id: string) {
      return u === USER && id === ID ? { ...sub } : null;
    },
    async patchSub(u: string, id: string, patch: object) {
      if (u !== USER || id !== ID) return false;
      patches.push(patch);
      Object.assign(sub, patch);
      return true;
    },
    async listSubsWithReminders() {
      return { subs: [sub], reminders };
    },
    async insertReminder(r: Omit<ReminderRow, "id" | "status">) {
      if (o.failInserts) return "XX000";
      reminders.push({ ...r, id: `r${++seq}`, status: "pending" });
      return null;
    },
    async setReminderStatus(ids: string[], to: "pending" | "skipped") {
      for (const r of reminders) if (ids.includes(r.id)) r.status = to;
    },
  } as unknown as SubDb;
  return { db, sub, reminders, patches };
}
const pending = (r: ReminderRow[]) => r.filter((x) => x.status === "pending").length;

describe("mark stopped", () => {
  it("skips all pending reminders, keeps the first stamp, undo reopens", async () => {
    const f = fake();
    await extendStopDate(f.db, USER, ID, "2026-12-17", NOW); // seeds reminders
    expect(pending(f.reminders)).toBeGreaterThan(0);
    expect(await markStopped(f.db, USER, ID, NOW)).toEqual({ ok: true });
    expect(f.sub.stop_confirmed_at).toBe(NOW.toISOString());
    expect(pending(f.reminders)).toBe(0);
    await markStopped(f.db, USER, ID, new Date("2026-11-26T00:00:00Z"));
    expect(f.sub.stop_confirmed_at).toBe(NOW.toISOString());
    expect(await unmarkStopped(f.db, USER, ID, NOW)).toEqual({ ok: true });
    expect(f.sub.stop_confirmed_at).toBeNull();
    expect(pending(f.reminders)).toBeGreaterThan(0);
  });
  it("merchant cancel writes only its column and undoes", async () => {
    const f = fake();
    await markMerchantCancelled(f.db, USER, ID, NOW);
    expect(f.patches).toEqual([{ merchant_cancelled_at: NOW.toISOString() }]);
    await unmarkMerchantCancelled(f.db, USER, ID, NOW);
    expect(f.sub.merchant_cancelled_at).toBeNull();
  });
  it("other user gets not_found and nothing changes", async () => {
    const f = fake();
    expect(await markStopped(f.db, "u2", ID, NOW)).toEqual({ ok: false, error: "not_found" });
    expect(f.patches).toEqual([]);
  });
  it("rebuild failure after the write returns rebuild_failed", async () => {
    const f = fake({ failInserts: true });
    const r = await extendStopDate(f.db, USER, ID, "2026-12-19", NOW);
    expect(r).toEqual({ ok: false, error: "rebuild_failed" });
    expect(f.sub.stop_date).toBe("2026-12-19");
  });
});

describe("extendStopDate", () => {
  it("moves the date and rebuilds reminders", async () => {
    const f = fake();
    expect(await extendStopDate(f.db, USER, ID, "2026-12-19", NOW)).toEqual({ ok: true });
    expect(f.patches).toEqual([{ stop_date: "2026-12-19" }]);
    expect(f.reminders.some((r) => r.fire_at.startsWith("2026-12-18"))).toBe(true); // -1 day
  });
  it("rejects bad, late and past dates without writing", async () => {
    const f = fake();
    const r = (d: string) => extendStopDate(f.db, USER, ID, d, NOW);
    expect(await r("2026-02-30")).toEqual({ ok: false, fieldError: "Enter a real date." });
    expect(await r("2026-12-21")).toEqual({
      ok: false,
      fieldError: "Pick a date on or before the renewal date, 20 Dec 2026.",
    });
    expect(await r("2026-11-20")).toEqual({
      ok: false,
      fieldError: "That date has passed. Pick today or a later date.",
    });
    expect(f.patches).toEqual([]);
  });
  it("rejects when there is no renewal date; not_found for others", async () => {
    expect(
      await extendStopDate(fake({ renewal: null }).db, USER, ID, "2026-12-19", NOW),
    ).toMatchObject({
      ok: false,
      fieldError: expect.any(String),
    });
    expect(await extendStopDate(fake().db, "u2", ID, "2026-12-19", NOW)).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});
