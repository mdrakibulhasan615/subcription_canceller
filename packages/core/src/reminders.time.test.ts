import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  planReminders,
  type ExistingReminder,
  type ReminderProfile,
  type ReminderSubInput,
} from "./reminders";

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
const prof = (timezone: string, extra: Partial<ReminderProfile> = {}): ReminderProfile => ({
  timezone,
  reminderDays: [1],
  ...extra,
});
const clock = (iso: string) => vi.setSystemTime(new Date(iso));
const plan = (s: ReminderSubInput, p: ReminderProfile, existing: ExistingReminder[] = []) =>
  planReminders(s, p, existing, new Date());
const apply = (
  ins: { type: ExistingReminder["type"]; channel: ExistingReminder["channel"]; fireAt: string }[],
) => ins.map((r, i): ExistingReminder => ({ ...r, id: `r${i}`, status: "pending" }));
const emailFires = (d: { toInsert: { channel: string; fireAt: string }[] }) =>
  d.toInsert.filter((r) => r.channel === "email").map((r) => r.fireAt);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("planReminders over time", () => {
  it("1: Sydney DST start and end keep 09:00 local", () => {
    clock("2026-09-01T00:00:00.000Z");
    const p = prof("Australia/Sydney", { sendHour: 9 });
    // DST starts 2026-10-04: day before is +10, the day of the change fire date is +11.
    expect(emailFires(plan(sub({ stopDate: "2026-10-04" }), p))).toEqual([
      "2026-10-02T23:00:00.000Z",
    ]);
    expect(emailFires(plan(sub({ stopDate: "2026-10-05" }), p))).toEqual([
      "2026-10-03T22:00:00.000Z",
    ]);
    // DST ends 2027-04-04.
    expect(emailFires(plan(sub({ stopDate: "2027-04-04" }), p))).toEqual([
      "2027-04-02T22:00:00.000Z",
    ]);
    expect(emailFires(plan(sub({ stopDate: "2027-04-05" }), p))).toEqual([
      "2027-04-03T23:00:00.000Z",
    ]);
  });

  it("2: London 01:00 on the spring-forward day (gap) gives a valid time that day", () => {
    clock("2027-03-01T00:00:00.000Z");
    const p = prof("Europe/London", { sendHour: 1 });
    const d = plan(sub({ stopDate: "2027-03-29" }), p);
    expect(d.toInsert).toHaveLength(2);
    const t = new Date(d.toInsert[0]!.fireAt).getTime();
    expect(Number.isNaN(t)).toBe(false);
    expect(t).toBeGreaterThanOrEqual(Date.parse("2027-03-28T00:00:00.000Z"));
    expect(t).toBeLessThan(Date.parse("2027-03-28T03:00:00.000Z"));
  });

  it("3: sent row stays when the stop date moves later; only future rows change", () => {
    const p = prof("UTC", { reminderDays: [7, 3, 1] });
    clock("2026-11-24T00:00:00.000Z");
    const saved = apply(plan(sub(), p).toInsert);
    expect(saved).toHaveLength(6);
    clock("2026-11-28T00:00:00.000Z");
    const rows = saved.map((r) =>
      r.fireAt < "2026-11-28" ? { ...r, status: "sent" as const } : r,
    );
    const sentIds = rows.filter((r) => r.status === "sent").map((r) => r.id);
    expect(sentIds).toHaveLength(2);
    const d = plan(sub({ stopDate: "2026-12-14" }), p, rows);
    expect(d.toCancel.sort()).toEqual(
      rows
        .filter((r) => r.status === "pending")
        .map((r) => r.id)
        .sort(),
    );
    expect(d.toCancel.some((id) => sentIds.includes(id))).toBe(false);
    expect(d.toInsert).toHaveLength(6);
    expect(d.toInsert.every((r) => Date.parse(r.fireAt) > Date.now())).toBe(true);
  });

  it("4: timezone change after the 7-day reminder was sent moves pending rows only", () => {
    const p = prof("UTC", { reminderDays: [7, 3, 1] });
    clock("2026-11-24T00:00:00.000Z");
    const saved = apply(plan(sub(), p).toInsert);
    clock("2026-11-28T00:00:00.000Z");
    const rows = saved.map((r) =>
      r.fireAt < "2026-11-28" ? { ...r, status: "sent" as const } : r,
    );
    const d = plan(sub(), { ...p, timezone: "Asia/Kuala_Lumpur" }, rows);
    expect(d.toCancel.sort()).toEqual(
      rows
        .filter((r) => r.status === "pending")
        .map((r) => r.id)
        .sort(),
    );
    expect(emailFires(d)).toEqual(["2026-12-01T01:00:00.000Z", "2026-12-03T01:00:00.000Z"]);
  });

  it("5: stop date today or yesterday in the user timezone gives no stop rows", () => {
    // 2026-11-24T20:00Z is 2026-11-25 09:00 in Auckland.
    clock("2026-11-24T20:00:00.000Z");
    const p = prof("Pacific/Auckland", { reminderDays: [7, 3, 1] });
    expect(plan(sub({ stopDate: "2026-11-25" }), p)).toEqual({
      toInsert: [],
      toCancel: [],
      toReopen: [],
    });
    expect(plan(sub({ stopDate: "2026-11-24" }), p)).toEqual({
      toInsert: [],
      toCancel: [],
      toReopen: [],
    });
  });

  it("6: renewal on the stop date keeps both with unique keys", () => {
    clock("2026-11-24T00:00:00.000Z");
    const p = prof("UTC", { reminderDays: [7, 3, 1] });
    const d = plan(sub({ stopDate: "2026-12-04", nextRenewalDate: "2026-12-04" }), p);
    expect(d.toInsert).toHaveLength(8);
    expect(new Set(d.toInsert.map((r) => `${r.type}|${r.channel}|${r.fireAt}`)).size).toBe(8);
    expect(d.toInsert.filter((r) => r.type === "renewal")).toHaveLength(2);
  });

  it("7: planning twice with the same clock gives an empty diff", () => {
    clock("2026-11-24T00:00:00.000Z");
    const p = prof("America/New_York", { reminderDays: [7, 3, 1] });
    const s = sub({ nextRenewalDate: "2026-12-07" });
    const first = plan(s, p);
    expect(first.toInsert.length).toBeGreaterThan(0);
    expect(plan(s, p, apply(first.toInsert))).toEqual({ toInsert: [], toCancel: [], toReopen: [] });
  });
});
