import { describe, expect, test } from "vitest";
import { monthlyMinor, yearlyMinor } from "./cost";

describe("cost", () => {
  test.each([
    [1200, "monthly", 1, 14400, 1200],
    [1200, "yearly", 1, 1200, 100],
    [3000, "quarterly", 1, 12000, 1000],
    [1000, "weekly", 1, 52143, 4345],
    [500, "custom", 30, 6083, 507],
    [1200, "monthly", 2, 7200, 600],
  ] as const)("%i %s x%i", (price, cycle, interval, yearly, monthly) => {
    expect(yearlyMinor(price, { cycle, interval })).toBe(yearly);
    expect(monthlyMinor(price, { cycle, interval })).toBe(monthly);
  });
  test.each([0, -1, 1.5, NaN])("rejects interval %s", (interval) => {
    expect(() => yearlyMinor(100, { cycle: "monthly", interval })).toThrow(RangeError);
    expect(() => monthlyMinor(100, { cycle: "monthly", interval })).toThrow(RangeError);
  });
});
