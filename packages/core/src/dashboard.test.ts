import { describe, expect, it } from "vitest";
import {
  categoryBreakdown,
  countedSubs,
  savings,
  totals,
  upcoming,
  type DashSub,
} from "./dashboard";

const TODAY = "2026-06-15";
let n = 0;
const sub = (o: Partial<DashSub> = {}): DashSub => ({
  id: `id${++n}`,
  name: `Sub ${n}`,
  category: null,
  price_minor: 1000,
  currency: "USD",
  billing_cycle: "monthly",
  billing_interval: 1,
  next_renewal_date: null,
  stop_date: null,
  stop_confirmed_at: null,
  merchant_cancelled_at: null,
  archived_at: null,
  ...o,
});
const stopped = (o: Partial<DashSub> = {}) => sub({ stop_confirmed_at: "2026-06-01", ...o });
const cancelled = (o: Partial<DashSub> = {}) => sub({ merchant_cancelled_at: "2026-06-01", ...o });

describe("countedSubs", () => {
  it("keeps active and stopping_soon (even a passed unconfirmed stop date), drops the rest", () => {
    const a = sub();
    const soon = sub({ stop_date: "2026-06-10" });
    const all = [a, soon, stopped(), cancelled(), sub({ archived_at: "2026-06-01" })];
    expect(countedSubs(all, TODAY)).toEqual([a, soon]);
  });
});

describe("totals", () => {
  it("sums per currency, yearly is not monthly x 12", () => {
    const r = totals(
      [
        sub(),
        sub({ price_minor: 1200, billing_cycle: "yearly" }),
        sub({ price_minor: 500, currency: "MYR" }),
      ],
      TODAY,
    );
    expect(r.monthly).toEqual({ USD: 1100, MYR: 500 });
    expect(r.yearly).toEqual({ USD: 13200, MYR: 6000 });
    expect(r.skipped).toBe(0);
  });
  it("skips a bad interval", () => {
    const r = totals([sub(), sub({ billing_cycle: "custom", billing_interval: 0 })], TODAY);
    expect(r.skipped).toBe(1);
    expect(r.monthly).toEqual({ USD: 1000 });
  });
  it("ignores stopped, cancelled, archived", () => {
    const r = totals([stopped(), cancelled(), sub({ archived_at: "2026-01-01" })], TODAY);
    expect(r).toEqual({ monthly: {}, yearly: {}, skipped: 0 });
  });
});

describe("upcoming", () => {
  it("returns 5 soonest, stop before renewal on ties, drops past renewals, keeps past stops", () => {
    const subs = [
      sub({ name: "A", stop_date: "2026-06-20", next_renewal_date: "2026-06-20" }),
      sub({ name: "B", next_renewal_date: "2026-06-25" }),
      sub({ name: "C", next_renewal_date: "2026-06-10" }),
      sub({ name: "D", stop_date: "2026-06-12" }),
      sub({ name: "E", stop_date: "2026-07-30" }),
      sub({ name: "F", next_renewal_date: "2026-08-01" }),
      sub({ name: "G", next_renewal_date: "2026-09-01" }),
      sub({ name: "H" }),
      stopped({ name: "X", stop_date: "2026-06-16" }),
    ];
    const r = upcoming(subs, TODAY);
    expect(r.map((e) => `${e.name}:${e.kind}`)).toEqual([
      "D:stop",
      "A:stop",
      "A:renewal",
      "B:renewal",
      "E:stop",
    ]);
    expect(r[0]).toMatchObject({ daysLeft: -3, status: "stopping_soon" });
    expect(r[1]).toMatchObject({ daysLeft: 5 });
  });
});

describe("savings", () => {
  it("sums stopped and cancelled, archived included", () => {
    const r = savings(
      [
        stopped(),
        cancelled({ price_minor: 12000, billing_cycle: "yearly" }),
        stopped({ archived_at: "2026-06-02", currency: "EUR", price_minor: 100 }),
        sub(),
      ],
      TODAY,
    );
    expect(r.yearly).toEqual({ USD: 24000, EUR: 1200 });
    expect(r.monthly).toEqual({ USD: 2000, EUR: 100 });
    expect(r.count).toBe(3);
  });
});

describe("categoryBreakdown", () => {
  it("groups, sorts descending, uses Uncategorised, follows currency order", () => {
    const r = categoryBreakdown(
      [
        sub({ category: "Video", price_minor: 3000 }),
        sub({ category: " Video ", price_minor: 1000 }),
        sub({ category: "  ", price_minor: 1000 }),
        sub({ category: "Music", price_minor: 500, currency: "MYR" }),
        stopped({ category: "Video" }),
      ],
      TODAY,
    );
    expect(Object.keys(r)).toEqual(["USD", "MYR"]);
    expect(r.USD).toEqual([
      { category: "Video", monthlyMinor: 4000, percent: 80 },
      { category: "Uncategorised", monthlyMinor: 1000, percent: 20 },
    ]);
    expect(r.MYR).toEqual([{ category: "Music", monthlyMinor: 500, percent: 100 }]);
  });
});
