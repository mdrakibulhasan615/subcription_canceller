import { describe, expect, it } from "vitest";
import {
  extendError,
  methodFor,
  methodText,
  parseStep,
  parseStepError,
  previewReminders,
  setStopMethod,
  STOP_METHODS,
  stopPassed,
} from "./stop-flow";
import { extendStopDate } from "./sub-actions";
import { parseSubForm, type SubDb, type SubFull } from "./subscriptions";

const NOW = new Date("2026-11-25T02:00:00Z");
const prof = { timezone: "UTC", reminder_days: [7, 3, 1], reminder_hour: 9 };
const sub = (o: Partial<SubFull> = {}): SubFull => ({
  id: "s1",
  name: "Tool",
  category: null,
  price_minor: 999,
  currency: "USD",
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
  archived_at: null,
  stop_confirmed_at: null,
  merchant_cancelled_at: null,
  created_at: "2026-11-01T00:00:00Z",
  ...o,
});

describe("previewReminders", () => {
  it("lists stop-date and renewal rows with local times", () => {
    const r = previewReminders(sub(), prof, NOW);
    expect(r.filter((x) => x.type === "stop_date")).toHaveLength(6); // 3 days x 2 channels
    expect(r.filter((x) => x.type === "renewal")).toHaveLength(2);
    expect(r[0]!.local).toContain("09:00");
    expect(r[0]!.local).toContain("UTC");
  });
  it("trial with stop date: stop_date rows only", () => {
    const r = previewReminders(
      sub({ is_trial: true, trial_end_date: "2026-12-20", stop_date: "2026-12-17" }),
      prof,
      NOW,
    );
    expect(new Set(r.map((x) => x.type))).toEqual(new Set(["stop_date"]));
  });
  it("drops past dates, and gives none when all passed or inactive", () => {
    expect(
      previewReminders(
        sub({ stop_date: "2026-11-20", next_renewal_date: "2026-11-21" }),
        prof,
        NOW,
      ),
    ).toEqual([]);
    expect(previewReminders(sub({ stop_confirmed_at: "2026-11-24T00:00:00Z" }), prof, NOW)).toEqual(
      [],
    );
    const some = previewReminders(sub({ stop_date: "2026-11-27" }), prof, NOW);
    expect(some.every((x) => x.local.includes("2026"))).toBe(true);
  });
  it("bad timezone falls back to UTC", () => {
    const r = previewReminders(sub(), { ...prof, timezone: "Nope/Zone" }, NOW);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0]!.local).toContain("UTC");
  });
});

describe("stopPassed", () => {
  it("is true only after the stop date", () => {
    expect(stopPassed(sub({ stop_date: "2026-11-24" }), "2026-11-25")).toBe(true);
    expect(stopPassed(sub({ stop_date: "2026-11-25" }), "2026-11-25")).toBe(false);
    expect(stopPassed(sub({ stop_date: null }), "2026-11-25")).toBe(false);
  });
  it("is false for stopped, cancelled or archived", () => {
    const old = { stop_date: "2026-11-01" };
    for (const k of ["stop_confirmed_at", "merchant_cancelled_at", "archived_at"] as const) {
      expect(stopPassed(sub({ ...old, [k]: "2026-11-02T00:00:00Z" }), "2026-11-25")).toBe(false);
    }
  });
});

describe("methods", () => {
  it("every method text says it does not cancel, and maps to a valid payment type", () => {
    for (const m of STOP_METHODS) {
      expect(methodText(m)).toContain("does not cancel");
      expect(["none", "wise", "privacy", "other_virtual"]).toContain(m.payment);
    }
    expect(methodFor("wise")).toBe("wise");
    expect(methodFor("none")).toBeNull();
  });
  it("parses unknown step and error values to safe defaults", () => {
    expect(parseStep(undefined)).toBe("1");
    expect(parseStep("<script>")).toBe("1");
    expect(parseStep(["3", "1"])).toBe("3");
    expect(parseStep("done")).toBe("done");
    expect(parseStepError("<b>")).toBeNull();
    expect(parseStepError("past")).toBe("past");
  });
});

function fake() {
  const row = sub();
  const patches: object[] = [];
  const writes: string[] = [];
  const db = {
    async getProfile() {
      return {
        ...prof,
        display_name: null,
        currency: "USD",
        default_stop_days_before: 3,
        email_reminders: true,
      };
    },
    async getSub(u: string, id: string) {
      return u === "u1" && id === "s1" ? { ...row } : null;
    },
    async patchSub(u: string, id: string, p: object) {
      if (u !== "u1" || id !== "s1") return false;
      patches.push(p);
      Object.assign(row, p);
      return true;
    },
    async listSubsWithReminders() {
      return { subs: [row], reminders: [] };
    },
    async insertReminder() {
      writes.push("insert");
      return null;
    },
    async setReminderStatus() {
      writes.push("status");
    },
  } as unknown as SubDb;
  return { db, row, patches, writes };
}

describe("step actions", () => {
  it("step 1: valid date patches and rebuilds; late date errors without a write", async () => {
    const f = fake();
    expect(extendError(await extendStopDate(f.db, "u1", "s1", "2026-12-19", NOW))).toBeNull();
    expect(f.row.stop_date).toBe("2026-12-19");
    expect(f.writes).toContain("insert");
    const bad = await extendStopDate(f.db, "u1", "s1", "2026-12-21", NOW);
    expect(extendError(bad)).toBe("after");
    expect(f.row.stop_date).toBe("2026-12-19");
    expect(extendError(await extendStopDate(f.db, "u1", "s1", "2026-11-01", NOW))).toBe("past");
    expect(extendError(await extendStopDate(f.db, "u1", "s1", "nope", NOW))).toBe("invalid");
  });
  it("step 2: patches only payment_method_type; merchant gives none; bad key rejected", async () => {
    const f = fake();
    expect(await setStopMethod(f.db, "u1", "s1", "wise")).toEqual({ ok: true });
    expect(f.patches).toEqual([{ payment_method_type: "wise" }]);
    await setStopMethod(f.db, "u1", "s1", "merchant");
    expect(f.row.payment_method_type).toBe("none");
    expect(await setStopMethod(f.db, "u1", "s1", "managed")).toEqual({
      ok: false,
      error: "method",
    });
    expect(await setStopMethod(f.db, "u2", "s1", "wise")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(f.patches).toHaveLength(2);
  });
  it("step 3 preview makes no DB write", () => {
    const f = fake();
    previewReminders(f.row as SubFull, prof, NOW);
    expect(f.writes).toEqual([]);
    expect(f.patches).toEqual([]);
  });
});

describe("trial form mapping", () => {
  it("trial end D, default N: renewal = D, stop = D - N", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      name: "Trial tool",
      price: "9.99",
      currency: "USD",
      billing_cycle: "monthly",
      billing_interval: "30",
      next_renewal_date: "2026-12-20",
      stop_date: "",
      payment_method_type: "none",
      is_trial: "on",
      trial_end_date: "2026-12-20",
    })) {
      fd.set(k, v);
    }
    const r = parseSubForm(fd, { default_stop_days_before: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        is_trial: true,
        trial_end_date: "2026-12-20",
        next_renewal_date: "2026-12-20",
        stop_date: "2026-12-17",
      });
    }
  });
});
