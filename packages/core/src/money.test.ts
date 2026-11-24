import { describe, expect, test } from "vitest";
import { formatMoney, sumByCurrency, toMinor } from "./money";

describe("toMinor", () => {
  test("parses valid amounts", () => {
    expect(toMinor("9.99", "USD")).toBe(999);
    expect(toMinor("0", "USD")).toBe(0);
    expect(toMinor("0.5", "USD")).toBe(50);
  });
  test.each(["9.999", "-1", "1e3", "", ","])("rejects %j", (s) => {
    expect(() => toMinor(s, "USD")).toThrow(RangeError);
  });
  test("rejects bad currency", () => {
    expect(() => toMinor("1", "JPY" as never)).toThrow(RangeError);
  });
});

describe("formatMoney", () => {
  test("formats currencies", () => {
    expect(formatMoney(999, "USD")).toBe("$9.99");
    expect(formatMoney(999, "EUR")).toBe("€9.99");
    expect(formatMoney(999, "GBP")).toBe("£9.99");
    expect(formatMoney(999, "MYR")).toContain("9.99");
  });
});

describe("sumByCurrency", () => {
  test("sums per currency", () => {
    expect(
      sumByCurrency([
        { minor: 100, currency: "USD" },
        { minor: 250, currency: "USD" },
        { minor: 500, currency: "MYR" },
      ]),
    ).toEqual({ USD: 350, MYR: 500 });
  });
});
