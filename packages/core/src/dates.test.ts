import { describe, expect, test } from "vitest";
import {
  addDays,
  addMonthsClamped,
  daysBetween,
  defaultStopDate,
  isIsoDate,
  nextRenewal,
} from "./dates";

const monthly = { cycle: "monthly", interval: 1 } as const;

describe("nextRenewal", () => {
  test("clamps month end without drift", () => {
    expect(nextRenewal("2026-01-31", monthly, "2026-02-10")).toBe("2026-02-28");
    expect(nextRenewal("2026-01-31", monthly, "2026-03-01")).toBe("2026-03-31");
  });
  test("leap anchor yearly", () => {
    const y = { cycle: "yearly", interval: 1 } as const;
    expect(nextRenewal("2028-02-29", y, "2029-01-01")).toBe("2029-02-28");
    expect(nextRenewal("2028-02-29", y, "2032-01-01")).toBe("2032-02-29");
  });
  test("anchor today or future returns anchor", () => {
    expect(nextRenewal("2026-12-15", monthly, "2026-12-15")).toBe("2026-12-15");
    expect(nextRenewal("2027-05-01", monthly, "2026-12-15")).toBe("2027-05-01");
  });
  test("weekly and custom", () => {
    const w = { cycle: "weekly", interval: 2 } as const;
    expect(nextRenewal("2026-11-02", w, "2026-11-24")).toBe("2026-11-30");
    const c = { cycle: "custom", interval: 10 } as const;
    expect(nextRenewal("2026-11-02", c, "2026-11-24")).toBe("2026-12-02");
  });
  test("quarterly and bad input", () => {
    const q = { cycle: "quarterly", interval: 1 } as const;
    expect(nextRenewal("2026-01-31", q, "2026-02-01")).toBe("2026-04-30");
    expect(() => nextRenewal("2026-02-30", monthly, "2026-03-01")).toThrow(RangeError);
    const bad = { cycle: "monthly", interval: 0 } as const;
    expect(() => nextRenewal("2026-01-01", bad, "2026-03-01")).toThrow(RangeError);
  });
});

describe("helpers", () => {
  test("defaultStopDate", () => {
    expect(defaultStopDate("2026-03-02", 3)).toBe("2026-02-27");
    expect(defaultStopDate("2028-03-01", 3)).toBe("2028-02-27");
    expect(defaultStopDate("2026-03-10")).toBe("2026-03-07");
  });
  test("addDays, addMonthsClamped, daysBetween", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonthsClamped("2026-01-31", -2)).toBe("2025-11-30");
    expect(daysBetween("2026-11-24", "2026-12-01")).toBe(7);
    expect(daysBetween("2026-12-01", "2026-11-24")).toBe(-7);
  });
  test("invalid dates throw", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => daysBetween("nope", "2026-01-01")).toThrow(RangeError);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
  });
});
