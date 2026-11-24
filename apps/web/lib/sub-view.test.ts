import type { Guide, ProfileSettings } from "@app/core";
import { describe, expect, it } from "vitest";
import {
  daysLeftText,
  filterSort,
  formatFireAt,
  loadDetail,
  loadList,
  nextEventDate,
  parseListParams,
  safeCancelUrl,
  storeHint,
  toRow,
  type ListParams,
} from "./sub-view";
import { todayIn, type HistoryRow, type SubDb, type SubFull } from "./subscriptions";

const ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-24T00:00:00Z");
const TODAY = "2026-11-24";
const sub = (o: Partial<SubFull> = {}): SubFull => ({
  id: ID,
  name: "Netflix",
  category: null,
  price_minor: 5590,
  currency: "MYR",
  billing_cycle: "monthly",
  billing_interval: 1,
  next_renewal_date: "2026-12-20",
  stop_date: "2026-12-17",
  payment_method_type: "wise",
  card_nickname: "Travel",
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
const P: ListParams = { status: null, sort: "next", archived: false };

function fakeDb(
  o: { subs?: SubFull[]; reminders?: HistoryRow[]; fail?: boolean; tz?: string } = {},
) {
  const boom = async () => {
    throw new Error("db down");
  };
  return {
    getProfile: o.fail
      ? boom
      : async () => ({ timezone: o.tz ?? "Asia/Kuala_Lumpur" }) as ProfileSettings,
    getSub: o.fail
      ? boom
      : async (u: string, id: string) =>
          u === "me" ? ((o.subs ?? []).find((s) => s.id === id) ?? null) : null,
    listSubs: o.fail ? boom : async () => o.subs ?? [],
    listRemindersForSub: async () => o.reminders ?? [],
  } as unknown as SubDb;
}

describe("parseListParams", () => {
  it("defaults on unknown, takes first of arrays", () => {
    expect(parseListParams({ status: "bogus", sort: "x" })).toEqual(P);
    expect(parseListParams({ status: ["stopped", "active"], sort: "name", archived: "1" })).toEqual(
      {
        status: "stopped",
        sort: "name",
        archived: true,
      },
    );
  });
});

describe("todayIn", () => {
  it("KL is a day ahead at UTC 17:00", () => {
    expect(todayIn("Asia/Kuala_Lumpur", new Date("2026-11-24T17:00:00Z"))).toBe("2026-11-25");
  });
});

describe("toRow", () => {
  it("derives statuses for stop dates 2, 30, 4 days away", () => {
    const st = (d: string) => toRow(sub({ stop_date: d }), TODAY).status;
    expect(st("2026-11-26")).toBe("stopping_soon");
    expect(st("2026-12-24")).toBe("active");
    expect(st("2026-11-28")).toBe("stopping_soon");
  });
  it("formats money and cycle", () => {
    const r = toRow(sub(), TODAY);
    expect(r.priceText).toContain("55.90");
    expect(r.cycleText).toBe("Monthly");
    expect(r.monthlyText).toContain("55.90");
    expect(r.daysLeft).toBe(23);
    expect(toRow(sub({ billing_cycle: "custom", billing_interval: 10 }), TODAY).cycleText).toBe(
      "Every 10 days",
    );
  });
  it("cancelled wins over stopped; stopped needs confirmation", () => {
    const both = { stop_confirmed_at: "x", merchant_cancelled_at: "y" };
    expect(toRow(sub(both), TODAY).status).toBe("cancelled");
    expect(toRow(sub({ stop_confirmed_at: "x" }), TODAY).status).toBe("stopped");
  });
  it("handles missing dates and a past stop date", () => {
    const r = toRow(sub({ stop_date: null, next_renewal_date: null }), TODAY);
    expect(r.daysLeft).toBeNull();
    expect(daysLeftText(r.daysLeft)).toBe("Not set");
    const past = toRow(sub({ stop_date: "2026-11-01" }), TODAY);
    expect(past.status).toBe("stopping_soon");
    expect(daysLeftText(past.daysLeft)).toBe("Stop date passed");
  });
  it("does not crash on a bad interval", () => {
    expect(toRow(sub({ billing_interval: 0 }), TODAY).monthlyText).toBe("Not available");
  });
});

describe("nextEventDate", () => {
  it("picks soonest future, else stop date, else null", () => {
    expect(nextEventDate("2026-12-01", "2026-11-30", TODAY)).toBe("2026-11-30");
    expect(nextEventDate("2026-11-01", "2026-11-10", TODAY)).toBe("2026-11-01");
    expect(nextEventDate("2026-11-01", "2026-12-10", TODAY)).toBe("2026-12-10");
    expect(nextEventDate(null, null, TODAY)).toBeNull();
  });
});

describe("filterSort", () => {
  const rows = [
    toRow(sub({ id: "a", name: "Zed", stop_date: "2026-12-30" }), TODAY),
    toRow(sub({ id: "b", name: "Amy", stop_date: null, next_renewal_date: null }), TODAY),
    toRow(sub({ id: "c", name: "Bob", stop_date: "2026-11-26" }), TODAY),
    toRow(sub({ id: "d", name: "Old", archived_at: "x" }), TODAY),
  ];
  it("soonest first, null last, archived hidden", () => {
    expect(filterSort(rows, P).map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(filterSort(rows, { ...P, archived: true }).some((r) => r.id === "d")).toBe(true);
  });
  it("name sort and status filter", () => {
    expect(filterSort(rows, { ...P, sort: "name" }).map((r) => r.name)).toEqual([
      "Amy",
      "Bob",
      "Zed",
    ]);
    expect(filterSort(rows, { ...P, status: "stopping_soon" }).map((r) => r.id)).toEqual(["c"]);
  });
});

describe("safeCancelUrl", () => {
  it("allows only https", () => {
    expect(safeCancelUrl(" https://x.com/c ")).toBe("https://x.com/c");
    for (const u of ["http://x.com", "javascript:alert(1)", "not a url", "", null]) {
      expect(safeCancelUrl(u)).toBeNull();
    }
  });
});

describe("storeHint", () => {
  it("only for store names", () => {
    expect(storeHint("Google Play Pass")).toBe("google-play");
    expect(storeHint("Netflix")).toBeNull();
  });
});

describe("formatFireAt", () => {
  it("uses the profile timezone and falls back to UTC", () => {
    expect(formatFireAt("2026-12-10T01:00:00Z", "Asia/Kuala_Lumpur")).toContain("09:00");
    expect(formatFireAt("2026-12-10T01:00:00Z", "Not/AZone")).toContain("01:00");
  });
});

describe("loadList", () => {
  it("returns rows and total", async () => {
    const v = await loadList(fakeDb({ subs: [sub()] }), "me", { status: "stopped" }, NOW);
    expect(v).toMatchObject({ rows: [], total: 1 });
  });
  it("returns error when the DB throws; bad timezone is fine", async () => {
    expect(await loadList(fakeDb({ fail: true }), "me", {}, NOW)).toBe("error");
    const v = await loadList(fakeDb({ subs: [sub()], tz: "Bad/Zone" }), "me", {}, NOW);
    expect(v).toMatchObject({ total: 1 });
  });
});

describe("loadDetail", () => {
  const guide = { kind: "cancel", service_slug: "netflix", title: "Netflix" } as Guide;
  const rem: HistoryRow = {
    type: "stop_date",
    channel: "email",
    fire_at: "x",
    status: "sent",
    sent_at: null,
  };
  it("returns guide, reminders and status", async () => {
    const db = fakeDb({ subs: [sub()], reminders: [rem] });
    const v = await loadDetail(db, "me", ID, NOW, async () => guide);
    expect(v).toMatchObject({ guide, reminders: [rem], status: "active", store: false });
  });
  it("no guide when the loader finds none or throws", async () => {
    const db = fakeDb({ subs: [sub({ name: "Spotify" })] });
    expect(await loadDetail(db, "me", ID, NOW, async () => null)).toMatchObject({ guide: null });
    const throws = async () => {
      throw new Error("x");
    };
    expect(await loadDetail(db, "me", ID, NOW, throws)).toMatchObject({ guide: null });
  });
  it("marks store subs", async () => {
    const db = fakeDb({ subs: [sub({ name: "Google Play" })] });
    expect(await loadDetail(db, "me", ID, NOW, async () => null)).toMatchObject({
      store: true,
      guide: null,
    });
  });
  it("not_found for bad id, missing row and other user", async () => {
    const db = fakeDb({ subs: [sub()] });
    expect(await loadDetail(db, "me", "nope", NOW)).toBe("not_found");
    expect(await loadDetail(db, "me", "22222222-2222-4222-8222-222222222222", NOW)).toBe(
      "not_found",
    );
    expect(await loadDetail(db, "other", ID, NOW)).toBe("not_found");
  });
  it("error when the DB throws", async () => {
    expect(await loadDetail(fakeDb({ fail: true }), "me", ID, NOW)).toBe("error");
  });
});
