import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatBadge,
  listNotifications,
  markRead,
  notificationText,
  unreadCount,
} from "./notifications";

// Records every chained call, then resolves like a Supabase query.
function fakeSb(result: unknown) {
  const calls: [string, unknown[]][] = [];
  const chain: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok),
  };
  for (const m of ["from", "select", "update", "eq", "is", "in", "order", "limit"]) {
    chain[m] = (...a: unknown[]) => {
      calls.push([m, a]);
      return chain;
    };
  }
  return { sb: chain as unknown as SupabaseClient, calls };
}
const sub = {
  name: "Netflix",
  stop_date: "2026-12-12",
  next_renewal_date: "2026-12-15",
  trial_end_date: null,
};
const NOW = new Date("2026-11-24T00:00:00Z");

describe("notificationText", () => {
  it("uses the key date by type and never says cancelled", () => {
    expect(notificationText("stop_date", sub, NOW)).toContain("Payments stop on 12 Dec 2026.");
    expect(notificationText("renewal", sub, NOW)).toContain("15 Dec 2026");
    expect(notificationText("trial_end", sub, NOW)).toContain("Check this subscription.");
    const trial = notificationText("trial_end", { ...sub, trial_end_date: "2026-12-10" }, NOW);
    expect(trial).toContain("The free trial ends on 10 Dec 2026. Payments can start on that date.");
    const ren = notificationText("renewal", sub, NOW);
    expect(ren).toContain("Netflix renews on 15 Dec 2026. To stop payments, freeze or close");
    for (const x of [ren, trial]) {
      expect(x.toLowerCase()).not.toContain("payments stop on");
      expect(x).toContain("Blocking a card does not cancel the subscription.");
    }
    expect(notificationText("stop_date", sub, NOW).toLowerCase()).not.toContain("cancelled");
    expect(notificationText("stop_date", { ...sub, stop_date: "2026-11-01" }, NOW)).toContain(
      "The date was 1 Nov 2026.",
    );
  });
});

describe("notificationText timezone", () => {
  it("uses the user's today, not UTC", () => {
    // 2026-11-24 20:00 UTC is 25 Nov in Kuala Lumpur: the 24 Nov date has passed there.
    const late = new Date("2026-11-24T20:00:00Z");
    const s = { ...sub, stop_date: "2026-11-24" };
    expect(notificationText("stop_date", s, late, "UTC")).toContain(
      "Payments stop on 24 Nov 2026.",
    );
    expect(notificationText("stop_date", s, late, "Asia/Kuala_Lumpur")).toContain(
      "The date was 24 Nov 2026.",
    );
    expect(notificationText("stop_date", s, late, "Bad/Zone")).toContain("Payments stop on");
  });
});

describe("formatBadge", () => {
  it("caps at 9+", () => {
    expect([formatBadge(3), formatBadge(9), formatBadge(10)]).toEqual(["3", "9", "9+"]);
  });
});

describe("listNotifications", () => {
  it("maps rows, accepts an array join, drops rows without a sub, orders newest first", async () => {
    const { sb, calls } = fakeSb({
      data: [
        {
          id: "a",
          type: "stop_date",
          fire_at: "2026-11-23T09:00:00Z",
          read_at: null,
          subscriptions: sub,
        },
        {
          id: "b",
          type: "stop_date",
          fire_at: "2026-11-22T09:00:00Z",
          read_at: "x",
          subscriptions: [sub],
        },
        {
          id: "c",
          type: "stop_date",
          fire_at: "2026-11-21T09:00:00Z",
          read_at: null,
          subscriptions: null,
        },
      ],
      error: null,
    });
    const items = await listNotifications(sb, NOW);
    expect(items.map((i) => [i.id, i.unread])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect(calls).toContainEqual(["order", ["fire_at", { ascending: false }]]);
    expect(calls).toContainEqual(["limit", [50]]);
    expect(calls).toContainEqual(["eq", ["channel", "in_app"]]);
    expect(calls).toContainEqual(["eq", ["status", "sent"]]);
  });
  it("throws on error", async () => {
    await expect(
      listNotifications(fakeSb({ data: null, error: new Error("x") }).sb),
    ).rejects.toThrow();
  });
});

describe("unreadCount", () => {
  it("returns the count, and 0 on error", async () => {
    expect(await unreadCount(fakeSb({ count: 3, error: null }).sb)).toBe(3);
    expect(await unreadCount(fakeSb({ count: null, error: { message: "x" } }).sb)).toBe(0);
  });
});

describe("markRead", () => {
  it("sets read_at on unread rows only", async () => {
    const { sb, calls } = fakeSb({ error: null });
    await markRead(sb, ["a", "b"], NOW);
    expect(calls).toContainEqual(["update", [{ read_at: NOW.toISOString() }]]);
    expect(calls).toContainEqual(["is", ["read_at", null]]);
    expect(calls).toContainEqual(["in", ["id", ["a", "b"]]]);
  });
  it("all skips the id filter; empty ids do nothing; error throws", async () => {
    const all = fakeSb({ error: null });
    await markRead(all.sb, "all", NOW);
    expect(all.calls.some(([m]) => m === "in")).toBe(false);
    const none = fakeSb({ error: null });
    await markRead(none.sb, [], NOW);
    expect(none.calls).toEqual([]);
    await expect(markRead(fakeSb({ error: new Error("x") }).sb, "all")).rejects.toThrow();
  });
});
