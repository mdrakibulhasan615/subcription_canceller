import type { ProfileSettings } from "@app/core";
import { describe, expect, it } from "vitest";
import { currenciesIn, dueText, loadDashboard, skippedText } from "./dashboard";
import type { SubDb, SubFull } from "./subscriptions";

const sub = (o: Partial<SubFull> = {}): SubFull => ({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Netflix",
  category: null,
  price_minor: 1000,
  currency: "USD",
  billing_cycle: "monthly",
  billing_interval: 1,
  next_renewal_date: "2026-12-20",
  stop_date: "2026-12-17",
  payment_method_type: "wise",
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

const fake = (o: { subs?: SubFull[]; tz?: string | null; fail?: boolean } = {}) =>
  ({
    getProfile: async () =>
      o.tz === null ? null : ({ timezone: o.tz ?? "UTC" } as ProfileSettings),
    listSubs: async () => {
      if (o.fail) throw new Error("db down");
      return o.subs ?? [];
    },
  }) as unknown as SubDb;

// 20:00 UTC is already 04:00 next day in Kuala Lumpur.
const NOW = new Date("2026-11-24T20:00:00Z");

describe("loadDashboard", () => {
  it("returns error when listSubs throws", async () => {
    expect(await loadDashboard(fake({ fail: true }), "me", NOW)).toBe("error");
  });
  it("falls back to UTC with no profile or a bad timezone", async () => {
    for (const tz of [null, "Nope/Zone"]) {
      const v = await loadDashboard(fake({ tz }), "me", NOW);
      expect(v).toMatchObject({ today: "2026-11-24", total: 0 });
    }
  });
  it("today follows the profile timezone", async () => {
    const v = await loadDashboard(fake({ tz: "Asia/Kuala_Lumpur" }), "me", NOW);
    expect(v).toMatchObject({ today: "2026-11-25" });
  });
  it("builds the view", async () => {
    const v = await loadDashboard(fake({ subs: [sub()] }), "me", NOW);
    if (v === "error") throw new Error("unexpected");
    expect(v.totals.monthly).toEqual({ USD: 1000 });
    expect(v.upcoming).toHaveLength(2);
    expect(v.counted).toBe(1);
    expect(v.categories.USD?.[0]?.category).toBe("Uncategorised");
  });
});

describe("text builders", () => {
  it("dueText", () => {
    expect([-1, 0, 1, 5].map((n) => dueText(n))).toEqual([
      "Stop date passed",
      "Today",
      "1 day",
      "5 days",
    ]);
    expect(dueText(-1, false)).toBe("Renewal date passed");
  });
  it("skippedText", () => {
    expect(skippedText(1)).toBe("1 subscription left out because of a bad billing interval.");
    expect(skippedText(2)).toContain("2 subscriptions");
  });
  it("currenciesIn keeps the fixed order", () => {
    expect(currenciesIn({ GBP: 1, USD: 2 })).toEqual(["USD", "GBP"]);
  });
});
