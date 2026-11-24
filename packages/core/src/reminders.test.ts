import { describe, expect, it } from "vitest";
import {
  desiredReminders,
  diffReminders,
  planReminders,
  reminderWrites,
  type ExistingReminder,
  type ReminderProfile,
  type ReminderSubInput,
} from "./reminders";

const now = new Date("2026-11-24T00:00:00.000Z");
const utc: ReminderProfile = { timezone: "UTC", reminderDays: [7, 3, 1] };
const sub = (o: Partial<ReminderSubInput> = {}): ReminderSubInput => ({
  stopDate: "2026-12-04",
  nextRenewalDate: null,
  isTrial: false,
  trialEndDate: null,
  stopConfirmedAt: null,
  merchantCancelledAt: null,
  archivedAt: null,
  ...o,
});
const fires = (s: ReminderSubInput, p: ReminderProfile, type = "stop_date") =>
  desiredReminders(s, p, now)
    .filter((r) => r.type === type)
    .map((r) => r.fireAt);
const asExisting = (s: ReminderSubInput, p = utc, status: ExistingReminder["status"] = "pending") =>
  desiredReminders(s, p, now).map((r, i) => ({ ...r, id: `id${i}`, status }));

describe("desiredReminders", () => {
  it("1: 6 stop_date rows, one per channel", () => {
    const r = desiredReminders(sub(), utc, now);
    expect(r).toHaveLength(6);
    expect(r.map((x) => `${x.type}|${x.channel}|${x.fireAt}`)).toEqual([
      "stop_date|email|2026-11-27T09:00:00.000Z",
      "stop_date|in_app|2026-11-27T09:00:00.000Z",
      "stop_date|email|2026-12-01T09:00:00.000Z",
      "stop_date|in_app|2026-12-01T09:00:00.000Z",
      "stop_date|email|2026-12-03T09:00:00.000Z",
      "stop_date|in_app|2026-12-03T09:00:00.000Z",
    ]);
  });
  it("2: Kuala Lumpur 09:00 is 01:00Z", () => {
    const p = { ...utc, timezone: "Asia/Kuala_Lumpur", reminderDays: [1] };
    expect(fires(sub(), p)[0]).toBe("2026-12-03T01:00:00.000Z");
  });
  it("3: New York spring forward", () => {
    const p = { ...utc, timezone: "America/New_York", reminderDays: [1] };
    expect(fires(sub({ stopDate: "2027-03-15" }), p)[0]).toBe("2027-03-14T13:00:00.000Z");
    expect(fires(sub({ stopDate: "2027-03-14" }), p)[0]).toBe("2027-03-13T14:00:00.000Z");
  });
  it("4: New York fall back", () => {
    const p = { ...utc, timezone: "America/New_York", reminderDays: [1] };
    expect(fires(sub({ stopDate: "2027-11-08" }), p)[0]).toBe("2027-11-07T14:00:00.000Z");
  });
  it("5: drops fireAt <= now", () => {
    const at = new Date("2026-12-01T09:00:00.000Z");
    const r = desiredReminders(sub(), utc, at);
    expect(r.map((x) => x.fireAt)).toEqual(Array(2).fill("2026-12-03T09:00:00.000Z"));
  });
  it("6: past stop date gives no rows", () => {
    expect(desiredReminders(sub({ stopDate: "2026-11-01" }), utc, now)).toEqual([]);
  });
  it("7: stop date after renewal is dropped, renewal kept", () => {
    const r = desiredReminders(
      sub({ stopDate: "2026-12-20", nextRenewalDate: "2026-12-10" }),
      utc,
      now,
    );
    expect(r.some((x) => x.type === "stop_date")).toBe(false);
    expect(r.filter((x) => x.type === "renewal").map((x) => x.fireAt)).toEqual(
      Array(2).fill("2026-12-09T09:00:00.000Z"),
    );
  });
  it("8: inactive subs give [] and plan cancels all pending", () => {
    const pending = asExisting(sub());
    const overdue: ExistingReminder = {
      type: "stop_date",
      channel: "email",
      fireAt: "2026-11-01T09:00:00.000Z",
      id: "old",
      status: "pending",
    };
    for (const o of [{ archivedAt: "x" }, { stopConfirmedAt: "x" }, { merchantCancelledAt: "x" }]) {
      const s = sub(o);
      expect(desiredReminders(s, utc, now)).toEqual([]);
      const d = planReminders(s, utc, [...pending, overdue], now);
      expect(d.toInsert).toEqual([]);
      expect(d.toCancel.sort()).toEqual([...pending.map((p) => p.id), "old"].sort());
    }
  });
  it("9: unchanged input gives empty diff", () => {
    expect(planReminders(sub(), utc, asExisting(sub()), now)).toEqual({
      toInsert: [],
      toCancel: [],
      toReopen: [],
    });
  });
  it("14: trial gives trial_end rows and no renewal", () => {
    const r = desiredReminders(
      sub({
        stopDate: null,
        isTrial: true,
        trialEndDate: "2026-12-04",
        nextRenewalDate: "2026-12-04",
      }),
      utc,
      now,
    );
    expect(r).toHaveLength(6);
    expect(r.every((x) => x.type === "trial_end")).toBe(true);
  });
  it("15: invalid timezone throws", () => {
    expect(() => desiredReminders(sub(), { ...utc, timezone: "Nope/Zone" }, now)).toThrow(
      RangeError,
    );
  });
  it("16: default channels", () => {
    const c = new Set(desiredReminders(sub(), utc, now).map((r) => r.channel));
    expect([...c].sort()).toEqual(["email", "in_app"]);
  });
  it("18: UTC+14 and UTC-12 use the local date", () => {
    const p = { ...utc, reminderDays: [1] };
    expect(fires(sub(), { ...p, timezone: "Pacific/Kiritimati" })[0]).toBe(
      "2026-12-02T19:00:00.000Z",
    );
    expect(fires(sub(), { ...p, timezone: "Etc/GMT+12" })[0]).toBe("2026-12-03T21:00:00.000Z");
  });
  it("rejects bad input and dedupes days", () => {
    expect(() => desiredReminders(sub(), { ...utc, reminderDays: [1.5] }, now)).toThrow(RangeError);
    expect(() => desiredReminders(sub(), { ...utc, sendHour: 24 }, now)).toThrow(RangeError);
    expect(() => desiredReminders(sub({ stopDate: "2026-02-30" }), utc, now)).toThrow(RangeError);
    expect(desiredReminders(sub(), { ...utc, reminderDays: [1, 1, 0, -2] }, now)).toHaveLength(2);
    expect(desiredReminders(sub(), { ...utc, reminderDays: [] }, now)).toEqual([]);
  });
});

describe("diff", () => {
  it("10: moved stop date", () => {
    const old = [
      ...asExisting(sub()),
      ...asExisting(sub(), utc, "sent").map((r) => ({
        ...r,
        id: `s${r.id}`,
        fireAt: "2026-11-20T09:00:00.000Z",
      })),
    ];
    const d = planReminders(sub({ stopDate: "2026-12-06" }), utc, old, now);
    expect(d.toCancel).toHaveLength(4);
    expect(d.toCancel.some((id) => id.startsWith("sid"))).toBe(false);
    expect(d.toInsert).toHaveLength(4);
    expect(d.toReopen).toEqual([]);
  });
  it("11: moved and moved back reopens skipped", () => {
    const skipped = asExisting(sub(), utc, "skipped");
    const d = planReminders(sub(), utc, skipped, now);
    expect(d.toReopen).toHaveLength(6);
    expect(d.toInsert).toEqual([]);
  });
  it("never re-inserts sent or failed rows", () => {
    const e = asExisting(sub(), utc, "failed");
    expect(planReminders(sub(), utc, e, now)).toEqual({ toInsert: [], toCancel: [], toReopen: [] });
  });
  it("12: timezone change moves pending, keeps sent", () => {
    const kl = { ...utc, timezone: "Asia/Kuala_Lumpur" };
    const sent = asExisting(sub(), utc, "sent").map((r) => ({ ...r, id: `s${r.id}` }));
    const pending = asExisting(sub(), utc).slice(2);
    const d = planReminders(sub(), kl, [...sent.slice(0, 2), ...pending], now);
    expect(d.toCancel.sort()).toEqual(pending.map((p) => p.id).sort());
    expect(d.toInsert).toHaveLength(6);
  });
  it("13: overdue pending not desired is left alone unless cancelOverdue", () => {
    const row: ExistingReminder = {
      type: "stop_date",
      channel: "email",
      fireAt: "2026-11-01T09:00:00.000Z",
      id: "o",
      status: "pending",
    };
    expect(diffReminders([], [row], now).toCancel).toEqual([]);
    expect(diffReminders([], [row], now, { cancelOverdue: true }).toCancel).toEqual(["o"]);
  });
  it("17: matches +00:00 existing fireAt", () => {
    const row: ExistingReminder = {
      type: "stop_date",
      channel: "email",
      fireAt: "2026-12-01T09:00:00+00:00",
      id: "p",
      status: "pending",
    };
    const want = [
      { type: "stop_date" as const, channel: "email" as const, fireAt: "2026-12-01T09:00:00.000Z" },
    ];
    expect(diffReminders(want, [row], now)).toEqual({ toInsert: [], toCancel: [], toReopen: [] });
  });
});

describe("reminderWrites", () => {
  it("maps inserts, cancels and reopens", () => {
    const w = reminderWrites(
      {
        toInsert: [
          { type: "stop_date", channel: "email", fireAt: "2026-12-01T09:00:00.000Z" },
          { type: "renewal", channel: "in_app", fireAt: "2026-12-02T09:00:00.000Z" },
        ],
        toCancel: ["c1"],
        toReopen: ["r1"],
      },
      "sub1",
      "user1",
    );
    expect(w.insert).toHaveLength(2);
    expect(w.insert[0]).toEqual({
      subscription_id: "sub1",
      user_id: "user1",
      type: "stop_date",
      channel: "email",
      fire_at: "2026-12-01T09:00:00.000Z",
    });
    expect(w.skipIds).toEqual(["c1"]);
    expect(w.reopenIds).toEqual(["r1"]);
  });
  it("gives empty arrays for an empty diff", () => {
    expect(reminderWrites({ toInsert: [], toCancel: [], toReopen: [] }, "s", "u")).toEqual({
      insert: [],
      skipIds: [],
      reopenIds: [],
    });
  });
});
