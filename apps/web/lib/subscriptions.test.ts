import { describe, expect, it } from "vitest";
import type { ProfileSettings } from "@app/core";
import type { NewReminder, ReminderRow } from "./profile-settings";
import {
  archiveSubscription,
  deleteSubscription,
  parseSubForm,
  safeRebuild,
  saveSubscription,
  todayIn,
  unarchiveSubscription,
  userIdFrom,
  type SubDb,
  type SubDetail,
} from "./subscriptions";

const NOW = new Date("2026-11-24T00:00:00Z");
const USER = "u1";
const OTHER = "u2";
const KEYS = ["channel", "fire_at", "subscription_id", "type", "user_id"];

const profile = (o: Partial<ProfileSettings> = {}): ProfileSettings => ({
  display_name: null,
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  default_stop_days_before: 3,
  reminder_days: [7, 3, 1],
  reminder_hour: 9,
  email_reminders: true,
  ...o,
});
const form = (o: Record<string, string> = {}) => {
  const fd = new FormData();
  const all = {
    name: "Netflix",
    price: "55.90",
    currency: "MYR",
    billing_cycle: "monthly",
    next_renewal_date: "2026-12-20",
    stop_date: "",
    ...o,
  };
  for (const [k, v] of Object.entries(all)) fd.set(k, v);
  return fd;
};

function fake(opts: { profile?: ProfileSettings | null; failInserts?: boolean } = {}) {
  const subs = new Map<string, SubDetail & { user_id: string }>();
  const reminders: (ReminderRow & { user_id: string })[] = [];
  const inserts: NewReminder[] = [];
  const statusCalls: { ids: string[]; to: string }[] = [];
  let seq = 0;
  const p = opts.profile === undefined ? profile() : opts.profile;
  const db: SubDb = {
    async getProfile() {
      return p;
    },
    async updateProfile() {},
    async listSubsWithReminders(userId) {
      return {
        subs: [...subs.values()]
          .filter((s) => s.user_id === userId)
          .map((s) => ({
            id: s.id,
            stop_date: s.stop_date,
            next_renewal_date: s.next_renewal_date,
            is_trial: s.is_trial,
            trial_end_date: s.trial_end_date,
            stop_confirmed_at: null,
            merchant_cancelled_at: null,
            archived_at: s.archived_at,
          })),
        reminders: reminders.filter((r) => r.user_id === userId),
      };
    },
    async insertReminder(r) {
      if (opts.failInserts) return "XX000";
      inserts.push(r);
      reminders.push({ ...r, id: `r${++seq}`, status: "pending" });
      return null;
    },
    async setReminderStatus(ids, to) {
      statusCalls.push({ ids, to });
      for (const r of reminders) if (ids.includes(r.id)) r.status = to;
    },
    async getSub(userId, id) {
      const s = subs.get(id);
      return s && s.user_id === userId
        ? { ...s, stop_confirmed_at: null, merchant_cancelled_at: null, created_at: "" }
        : null;
    },
    async listSubs() {
      return [];
    },
    async listRemindersForSub() {
      return [];
    },
    async listSubNames() {
      return [];
    },
    async insertSub(row) {
      const id = `s${++seq}`;
      subs.set(id, { ...row, id, archived_at: null });
      return id;
    },
    async updateSub(userId, id, row) {
      const s = subs.get(id);
      if (!s || s.user_id !== userId) return false;
      Object.assign(s, row);
      return true;
    },
    async setArchived(userId, id, at) {
      const s = subs.get(id);
      if (!s || s.user_id !== userId) return false;
      s.archived_at = at;
      return true;
    },
    async deleteSub(userId, id) {
      const s = subs.get(id);
      if (!s || s.user_id !== userId) return false;
      subs.delete(id);
      for (let i = reminders.length - 1; i >= 0; i--) {
        if (reminders[i]!.subscription_id === id) reminders.splice(i, 1);
      }
      return true;
    },
  };
  return { db, subs, reminders, inserts, statusCalls };
}

const fieldErrors = (r: unknown) => (r as { fieldErrors: Record<string, string> }).fieldErrors;

describe("saveSubscription", () => {
  it("C1 adds a sub with price in minor units and reminders with 5 keys", async () => {
    const f = fake();
    const r = await saveSubscription(f.db, USER, null, form(), NOW);
    expect(r.ok).toBe(true);
    const [s] = [...f.subs.values()];
    expect(s).toMatchObject({
      user_id: USER,
      name: "Netflix",
      price_minor: 5590,
      currency: "MYR",
      stop_date: "2026-12-17", // blank stop date: 3 days before renewal
      payment_method_type: "none",
      billing_interval: 1,
    });
    expect(s).not.toHaveProperty("stop_confirmed_at");
    expect(s).not.toHaveProperty("merchant_cancelled_at");
    // stop -7/-3/-1 (3 channels?) plus renewal -1: check keys and the 09:00 MYT hour.
    expect(f.inserts.length).toBeGreaterThan(0);
    for (const i of f.inserts) expect(Object.keys(i).sort()).toEqual(KEYS);
    expect(f.inserts.map((i) => i.fire_at)).toContain("2026-12-10T01:00:00.000Z");
  });

  it("C2 edit moves stop date: old pending skipped, new inserted, sent untouched", async () => {
    const f = fake();
    const r = await saveSubscription(f.db, USER, null, form(), NOW);
    const id = (r as { id: string }).id;
    f.reminders[0]!.status = "sent" as never;
    const sentId = f.reminders[0]!.id;
    const before = f.inserts.length;
    await saveSubscription(f.db, USER, id, form({ stop_date: "2026-12-19" }), NOW);
    expect(f.inserts.length).toBeGreaterThan(before);
    expect(f.reminders.find((x) => x.id === sentId)!.status).toBe("sent");
    expect(f.statusCalls.length).toBeGreaterThan(0);
    for (const c of f.statusCalls) expect(["skipped", "pending"]).toContain(c.to);
  });

  it("C3 another user's id is not_found and changes nothing", async () => {
    const f = fake();
    f.subs.set("x", { ...(await seed(f.db)), id: "x", user_id: OTHER });
    const r = await saveSubscription(f.db, USER, "x", form({ name: "Hacked" }), NOW);
    expect(r).toEqual({ ok: false, error: "not_found" });
    expect(f.subs.get("x")!.name).not.toBe("Hacked");
  });

  it("C4 card number in nickname or notes is rejected and nothing is written", async () => {
    for (const k of ["card_nickname", "notes"]) {
      const f = fake();
      const r = await saveSubscription(f.db, USER, null, form({ [k]: "4111-1111-1111-1111" }), NOW);
      expect(fieldErrors(r)[k]).toMatch(/card number/);
      expect(f.subs.size).toBe(0);
    }
    const f = fake();
    const r = await saveSubscription(
      f.db,
      USER,
      null,
      form({ card_nickname: "Wise streaming card" }),
      NOW,
    );
    expect(r.ok).toBe(true);
  });

  it("C5 stop after renewal is rejected with the schema message; past stop is saved", async () => {
    const f = fake();
    const bad = await saveSubscription(f.db, USER, null, form({ stop_date: "2026-12-21" }), NOW);
    expect(fieldErrors(bad).stop_date).toBe("Stop date must be on or before the renewal date");
    expect(f.subs.size).toBe(0);
    const past = await saveSubscription(f.db, USER, null, form({ stop_date: "2026-01-01" }), NOW);
    expect(past.ok).toBe(true);
  });

  it("C6 bad profile timezone: saved, reminders built in UTC", async () => {
    const f = fake({ profile: profile({ timezone: "Not/AZone" }) });
    const r = await saveSubscription(f.db, USER, null, form(), NOW);
    expect(r.ok).toBe(true);
    expect(f.inserts.map((i) => i.fire_at)).toContain("2026-12-10T09:00:00.000Z");
  });

  it("C7 rebuild failure keeps the sub and returns the id", async () => {
    const f = fake({ failInserts: true });
    const r = await saveSubscription(f.db, USER, null, form(), NOW);
    expect(r).toMatchObject({ ok: false, error: "rebuild_failed" });
    expect(f.subs.size).toBe(1);
    expect((r as { id: string }).id).toBe([...f.subs.keys()][0]);
  });

  it("C8 missing profile is a server error", async () => {
    const f = fake({ profile: null });
    expect(await saveSubscription(f.db, USER, null, form(), NOW)).toEqual({
      ok: false,
      error: "server",
    });
  });
});

async function seed(db: SubDb) {
  const id = await db.insertSub({
    name: "Seed",
    category: null,
    price_minor: 100,
    currency: "MYR",
    billing_cycle: "monthly",
    billing_interval: 1,
    next_renewal_date: "2026-12-20",
    stop_date: "2026-12-17",
    payment_method_type: "none",
    card_nickname: null,
    cancel_url: null,
    notes: null,
    is_trial: false,
    trial_end_date: null,
    user_id: USER,
  });
  return (await db.getSub(USER, id))! as SubDetail; // test rows always have both dates
}

describe("archive, unarchive, delete", () => {
  it("D1 archive skips pending; unarchive reopens future ones", async () => {
    const f = fake();
    const id = ((await saveSubscription(f.db, USER, null, form(), NOW)) as { id: string }).id;
    expect(f.reminders.every((r) => r.status === "pending")).toBe(true);
    expect(await archiveSubscription(f.db, USER, id, NOW)).toEqual({ ok: true });
    expect(f.subs.get(id)!.archived_at).toBe(NOW.toISOString());
    expect(f.reminders.every((r) => r.status === "skipped")).toBe(true);
    expect(await unarchiveSubscription(f.db, USER, id, NOW)).toEqual({ ok: true });
    expect(f.subs.get(id)!.archived_at).toBeNull();
    expect(f.reminders.every((r) => r.status === "pending")).toBe(true);
    for (const c of f.statusCalls) expect(["skipped", "pending"]).toContain(c.to);
  });

  it("D2 delete removes the row and its reminders", async () => {
    const f = fake();
    const id = ((await saveSubscription(f.db, USER, null, form(), NOW)) as { id: string }).id;
    expect(await deleteSubscription(f.db, USER, id, NOW)).toEqual({ ok: true });
    expect(f.subs.size).toBe(0);
    expect(f.reminders).toHaveLength(0);
  });

  it("D3 unknown or foreign id is not_found", async () => {
    const f = fake();
    f.subs.set("x", { ...(await seed(f.db)), id: "x", user_id: OTHER });
    for (const fn of [archiveSubscription, unarchiveSubscription, deleteSubscription]) {
      expect(await fn(f.db, USER, "x", NOW)).toEqual({ ok: false, error: "not_found" });
    }
    expect(f.subs.has("x")).toBe(true);
  });
});

describe("safeRebuild", () => {
  const p = { timezone: "Not/AZone", reminder_days: [7, 3, 1], reminder_hour: 9 };
  it("R1 RangeError retries once with UTC", async () => {
    const f = fake();
    await seed(f.db);
    expect(await safeRebuild(f.db, USER, p, NOW)).toEqual({ ok: true });
    expect(f.inserts.length).toBeGreaterThan(0);
  });
  it("R2 a second failure gives rebuild_failed", async () => {
    const f = fake({ failInserts: true });
    await seed(f.db);
    expect(await safeRebuild(f.db, USER, p, NOW)).toEqual({ ok: false, error: "rebuild_failed" });
  });
});

describe("parseSubForm", () => {
  const p = { default_stop_days_before: 3 };
  const err = (o: Record<string, string>) => {
    const r = parseSubForm(form(o), p);
    return r.ok ? {} : r.fieldErrors;
  };
  it("P1 rejects bad prices, accepts 0 and the max", () => {
    for (const price of ["9.999", "abc", "-1", "1,50", "", "1000000.01"]) {
      expect(err({ price }).price, price).toBeTruthy();
    }
    expect(err({ price: "0" }).price).toBeUndefined();
    expect(err({ price: "1000000.00" }).price).toBeUndefined();
  });
  it("P2 cancel_url scheme and trimming", () => {
    expect(err({ cancel_url: "javascript:alert(1)" }).cancel_url).toBe("Start with https://");
    expect(err({ cancel_url: "ftp://x" }).cancel_url).toBe("Start with https://");
    const ok = parseSubForm(form({ cancel_url: "  https://netflix.com/cancel " }), p);
    expect(ok.ok && ok.data.cancel_url).toBe("https://netflix.com/cancel");
  });
  it("P3 dates, trial and custom interval", () => {
    expect(err({ next_renewal_date: "2026-02-30" }).next_renewal_date).toBeTruthy();
    expect(err({ is_trial: "on" }).trial_end_date).toBeTruthy();
    for (const i of ["0", "366", "1.5", "x"]) {
      expect(
        err({ billing_cycle: "custom", billing_interval: i }).billing_interval,
        i,
      ).toBeTruthy();
    }
    const c = parseSubForm(form({ billing_cycle: "custom", billing_interval: "30" }), p);
    expect(c.ok && c.data.billing_interval).toBe(30);
    // Interval is forced to 1 when not custom; trial end is dropped when not a trial.
    const m = parseSubForm(form({ billing_interval: "30", trial_end_date: "2026-12-01" }), p);
    expect(m.ok && [m.data.billing_interval, m.data.trial_end_date]).toEqual([1, null]);
  });
  it("P4 managed payment type is blocked", () => {
    expect(err({ payment_method_type: "managed" }).payment_method_type).toBeTruthy();
  });
  it("P5 name over 100 characters", () => {
    expect(err({ name: "x".repeat(101) }).name).toBeTruthy();
  });
});

describe("helpers", () => {
  it("userIdFrom: no claims or no sub gives null", () => {
    expect(userIdFrom(null)).toBeNull();
    expect(userIdFrom({})).toBeNull();
    expect(userIdFrom({ sub: 5 })).toBeNull();
    expect(userIdFrom({ sub: "u1" })).toBe("u1");
  });
  it("todayIn uses the timezone and survives a bad one", () => {
    expect(todayIn("Asia/Kuala_Lumpur", new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-25");
    expect(todayIn("Not/AZone", new Date("2026-11-24T20:00:00Z"))).toBe("2026-11-24");
  });
});
