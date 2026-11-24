import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileSettings } from "@app/core";
import { commitImport, previewImport, resultMessage, type ImportDb } from "./csv-import";
import { _resetRateLimit } from "./rate-limit";
import type { NewReminder, ReminderRow } from "./profile-settings";
import type { SubFull } from "./subscriptions";

const NOW = new Date("2026-11-24T00:00:00Z");
const USER = "u1";
const KEYS = ["channel", "fire_at", "subscription_id", "type", "user_id"];
const H = "name,price,currency,billing_cycle,next_renewal_date,stop_date,card_nickname,notes";
const profile: ProfileSettings = {
  display_name: null,
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  default_stop_days_before: 3,
  reminder_days: [7, 3, 1],
  reminder_hour: 9,
  email_reminders: true,
};

function fake(opts: { failInsert?: boolean; failReminders?: boolean; existing?: SubFull[] } = {}) {
  const subs: (SubFull & { user_id: string })[] = (opts.existing ?? []).map((s) => ({
    ...s,
    user_id: USER,
  }));
  const reminders: (ReminderRow & { user_id: string })[] = [];
  const inserts: NewReminder[] = [];
  let insertCalls = 0;
  let listCalls = 0;
  const db = {
    async getProfile() {
      return profile;
    },
    async listSubs(userId: string) {
      return subs.filter((s) => s.user_id === userId);
    },
    async listSubsWithReminders() {
      listCalls++;
      return {
        subs: subs.map((s) => ({ ...s, stop_confirmed_at: null, merchant_cancelled_at: null })),
        reminders,
      };
    },
    async insertReminder(r: NewReminder) {
      if (opts.failReminders) return "XX000";
      inserts.push(r);
      reminders.push({ ...r, id: `r${inserts.length}`, status: "pending" });
      return null;
    },
    async setReminderStatus() {},
    async insertSubs(rows: Parameters<ImportDb["insertSubs"]>[0]) {
      insertCalls++;
      if (opts.failInsert) throw new Error("boom");
      for (const r of rows) {
        subs.push({
          ...r,
          id: `s${subs.length + 1}`,
          archived_at: null,
          stop_confirmed_at: null,
          merchant_cancelled_at: null,
          created_at: "",
        });
      }
      return rows.length;
    },
  } as unknown as ImportDb;
  return { db, subs, inserts, calls: () => ({ insertCalls, listCalls }) };
}

const line = (name: string, o: Partial<Record<string, string>> = {}) =>
  [
    name,
    o.price ?? "10.00",
    o.currency ?? "MYR",
    o.cycle ?? "monthly",
    o.renewal ?? "2026-12-20",
    o.stop ?? "",
    o.card ?? "",
    o.notes ?? "",
  ].join(",");
const file = (...lines: string[]) => [H, ...lines].join("\n");
const prev = async (csv: string, db = fake().db) => {
  const r = await previewImport(db, USER, csv, NOW);
  if (!r.ok) throw new Error(r.message);
  return r;
};

beforeEach(() => _resetRateLimit());

describe("previewImport", () => {
  it("C1 valid rows, default stop date, profile currency", async () => {
    const r = await prev(file(line("A"), line("B", { currency: "" }), line("C")));
    expect(r.counts).toEqual({ valid: 3, invalid: 0, duplicate: 0 });
  });
  it("C2 missing column names the column", async () => {
    const r = await previewImport(fake().db, USER, "name,billing_cycle\nA,monthly", NOW);
    expect(r).toMatchObject({ ok: false });
    expect(JSON.stringify(r)).toContain("price");
  });
  it("C4 duplicates in file and against existing (archived too)", async () => {
    const existing = {
      id: "e1",
      name: "Old",
      category: null,
      price_minor: 1000,
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
      archived_at: "2026-11-01T00:00:00Z",
      stop_confirmed_at: null,
      merchant_cancelled_at: null,
      created_at: "",
    } as SubFull;
    const r = await prev(
      file(
        line("Netflix"),
        line("Other"),
        line("x", { price: "9" }),
        line("Hulu", { cycle: "yearly" }),
        line("  NETFLIX "),
        line("Netflix", { price: "11" }),
        line("old"),
      ),
      fake({ existing: [existing] }).db,
    );
    expect(r.rows.map((x) => x.state)).toEqual([
      "valid",
      "valid",
      "valid",
      "valid",
      "duplicate",
      "valid",
      "duplicate",
    ]);
    expect(r.rows[4]!.reasons).toEqual(["Same as row 2"]);
    expect(r.rows[6]!.reasons).toEqual(["Already in your list"]);
  });
  it("C9 bad currency is invalid", async () => {
    const r = await prev(file(line("A", { currency: "CAD" })));
    expect(r.rows[0]!.state).toBe("invalid");
    expect(r.rows[0]!.reasons.join()).toContain("Choose a currency from the list.");
  });
  it("C10 card number is rejected and never echoed", async () => {
    const r = await prev(
      file(
        line("A", { card: "4111 1111 1111 1111" }),
        line("B", { card: "Wise 2024" }),
        line("C", { notes: "4111111111111111" }),
      ),
    );
    expect(r.rows.map((x) => x.state)).toEqual(["invalid", "valid", "invalid"]);
    expect(JSON.stringify(r)).not.toContain("4111");
  });
  it("C10b card number in the name is rejected and masked", async () => {
    const r = await prev(file(line("4111 1111 1111 1111"), line("Netflix")));
    expect(r.rows.map((x) => x.state)).toEqual(["invalid", "valid"]);
    expect(r.rows[0]!.name).toBe("");
    expect(JSON.stringify(r)).not.toContain("4111");
  });
  it("C11 past stop date warns, past renewal kept, stop after renewal invalid", async () => {
    const r = await prev(
      file(
        line("A", { stop: "2026-11-01" }),
        line("B", { renewal: "2026-11-10", stop: "2026-11-05" }),
        line("C", { stop: "2027-01-01" }),
        line("D", { renewal: "20/12/2026" }),
      ),
    );
    expect(r.rows.map((x) => x.state)).toEqual(["valid", "valid", "invalid", "invalid"]);
    expect(r.rows[0]!.warnings).toContain("No stop-date reminder will be sent");
    expect(r.rows[3]!.reasons.join()).toContain("YYYY-MM-DD");
    expect(r.rows[3]!.reasons.join()).not.toMatch(/\) Use YYYY/);
  });
  it("C16 formula-like names are kept as typed", async () => {
    const r = await prev(file(line('"=HYPERLINK(""x"")"')));
    expect(r.rows[0]!.name).toBe('=HYPERLINK("x")');
  });
});

describe("commitImport", () => {
  it("C1 inserts rows for the user, one rebuild, 5-key reminders", async () => {
    const f = fake();
    const r = await commitImport(f.db, USER, file(line("A"), line("B"), line("C")), NOW);
    expect(r).toMatchObject({ ok: true, imported: 3, skipped: 0, remindersOk: true });
    expect(f.calls().insertCalls).toBe(1);
    expect(f.calls().listCalls).toBe(1);
    expect(f.subs.map((s) => [s.user_id, s.price_minor, s.stop_date])).toEqual([
      [USER, 1000, "2026-12-17"],
      [USER, 1000, "2026-12-17"],
      [USER, 1000, "2026-12-17"],
    ]);
    expect(f.inserts.length).toBeGreaterThan(0);
    for (const i of f.inserts) expect(Object.keys(i).sort()).toEqual(KEYS);
  });
  it("C12 imports valid rows and skips the rest", async () => {
    const f = fake();
    const r = await commitImport(
      f.db,
      USER,
      file(line("A"), line("B", { price: "x" }), line("C", { price: "5" })),
      NOW,
    );
    expect(r).toMatchObject({ ok: true, imported: 2, skipped: 1 });
    if (r.ok)
      expect(resultMessage(r)).toBe("Imported 2. Skipped 1 (invalid or already in your list).");
  });
  it("C13 insert failure imports nothing and does not rebuild", async () => {
    const f = fake({ failInsert: true });
    const r = await commitImport(f.db, USER, file(line("A")), NOW);
    expect(r).toMatchObject({
      ok: false,
      error: "server",
      message: "Nothing was imported. Try again.",
    });
    expect(f.calls().listCalls).toBe(0);
  });
  it("C13 rebuild failure keeps rows and says so", async () => {
    const f = fake({ failReminders: true });
    const r = await commitImport(f.db, USER, file(line("A")), NOW);
    expect(r).toMatchObject({ ok: true, imported: 1, remindersOk: false });
    expect(f.subs).toHaveLength(1);
    if (r.ok) expect(resultMessage(r)).toContain("Reminders could not be updated");
  });
  it("C14 the same confirm twice adds no duplicates", async () => {
    const f = fake();
    const csv = file(line("A"), line("B"));
    await commitImport(f.db, USER, csv, NOW);
    const r = await commitImport(f.db, USER, csv, NOW);
    expect(r).toMatchObject({ ok: false, error: "nothing_to_import" });
    expect(f.subs).toHaveLength(2);
  });
  it("C15 the 6th import in 10 minutes is rate limited", async () => {
    const f = fake();
    for (let i = 0; i < 5; i++) await commitImport(f.db, USER, file(line(`S${i}`)), NOW);
    const r = await commitImport(f.db, USER, file(line("S9")), NOW);
    expect(r).toMatchObject({ ok: false, error: "rate_limited" });
    expect(r.ok ? 0 : r.retryAfterSec).toBeGreaterThan(0);
    expect((await previewImport(f.db, USER, file(line("S9")), NOW)).ok).toBe(true);
  });
  it("C3 forged oversized text is refused", async () => {
    const f = fake();
    const r = await commitImport(f.db, USER, file(line("A")) + "\n" + "x".repeat(210_000), NOW);
    expect(r).toMatchObject({ ok: false, error: "file" });
    expect(f.subs).toHaveLength(0);
  });
  it("C3 200 rows pass, 201 rows fail", async () => {
    const rows = (n: number) => file(...Array.from({ length: n }, (_, i) => line(`S${i}`)));
    expect((await previewImport(fake().db, USER, rows(200), NOW)).ok).toBe(true);
    expect((await previewImport(fake().db, USER, rows(201), NOW)).ok).toBe(false);
  });
  it("C18 refuses when the total would pass 500", async () => {
    const f = fake();
    for (let i = 0; i < 499; i++) {
      f.subs.push({ ...({} as SubFull), user_id: USER, name: `E${i}`, price_minor: 1 });
    }
    const r = await commitImport(f.db, USER, file(line("A"), line("B")), NOW);
    expect(r).toMatchObject({ ok: false, error: "too_many" });
    expect(f.calls().insertCalls).toBe(0);
  });
});
