import { describe, expect, test } from "vitest";
import { stopDateWarnings, subscriptionInputSchema as S } from "./schema";

const valid = {
  name: "Netflix",
  price_minor: 999,
  currency: "USD",
  billing_cycle: "monthly",
  next_renewal_date: "2026-12-15",
};

const failPaths = (patch: object) => {
  const r = S.safeParse({ ...valid, ...patch });
  expect(r.success).toBe(false);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("subscriptionInputSchema", () => {
  test("valid payload gets defaults", () => {
    const r = S.parse({ ...valid, name: "  Netflix  ", stop_date: "2026-12-12" });
    expect(r).toMatchObject({
      name: "Netflix",
      billing_interval: 1,
      payment_method_type: "none",
      is_trial: false,
    });
  });
  test("path-specific failures", () => {
    expect(failPaths({ price_minor: 9.5 })).toContain("price_minor");
    expect(failPaths({ price_minor: -1 })).toContain("price_minor");
    expect(failPaths({ currency: "JPY" })).toContain("currency");
    expect(failPaths({ name: "  " })).toContain("name");
    expect(failPaths({ cancel_url: "javascript:alert(1)" })).toContain("cancel_url");
    expect(failPaths({ next_renewal_date: "2026-02-30" })).toContain("next_renewal_date");
    expect(failPaths({ stop_date: "2026-12-16" })).toContain("stop_date");
    expect(failPaths({ is_trial: true })).toContain("trial_end_date");
  });
  test("accepts https url and past stop date", () => {
    const r = S.safeParse({
      ...valid,
      cancel_url: "https://example.com/x",
      stop_date: "2020-01-01",
    });
    expect(r.success).toBe(true);
  });
});

describe("stopDateWarnings", () => {
  const next_renewal_date = "2026-12-15";
  const w = (stop_date: string | undefined) =>
    stopDateWarnings({ stop_date, next_renewal_date }, "2026-11-24");
  test("flags", () => {
    expect(w("2026-11-01")).toEqual(["stop_in_past"]);
    expect(w("2026-12-16")).toEqual(["stop_after_renewal"]);
    expect(w("2026-12-12")).toEqual([]);
    expect(w(undefined)).toEqual([]);
  });
});
