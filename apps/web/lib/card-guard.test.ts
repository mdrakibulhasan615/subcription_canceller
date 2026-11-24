import { describe, expect, it } from "vitest";
import { looksLikeCardNumber } from "./card-guard";
import { previewCost } from "./sub-cost";

describe("looksLikeCardNumber", () => {
  it("accepts Luhn-valid 13, 16 and 19 digits with spaces or dashes", () => {
    expect(looksLikeCardNumber("4222222222222")).toBe(true);
    expect(looksLikeCardNumber("4111 1111 1111 1111")).toBe(true);
    expect(looksLikeCardNumber("4111-1111-1111-1111")).toBe(true);
    expect(looksLikeCardNumber("6200000000000005")).toBe(true);
    expect(looksLikeCardNumber("4111 1111 1111 1111 110")).toBe(true);
  });
  it("accepts text, bad Luhn, and wrong lengths", () => {
    expect(looksLikeCardNumber("Wise 2024")).toBe(false);
    expect(looksLikeCardNumber("4111111111111112")).toBe(false);
    expect(looksLikeCardNumber("411111111111")).toBe(false); // 12
    expect(looksLikeCardNumber("41111111111111111111")).toBe(false); // 20
  });
});

describe("previewCost", () => {
  it("yearly 10.00 gives 0.83 a month", () => {
    expect(previewCost("10.00", "USD", "yearly", 1)).toEqual({
      monthly: "$0.83",
      yearly: "$10.00",
    });
  });
  it("custom 30 days gives 121.67 a year", () => {
    expect(previewCost("10", "USD", "custom", 30)?.yearly).toBe("$121.67");
  });
  it("monthly 9.99", () => {
    expect(previewCost("9.99", "USD", "monthly", 1)).toEqual({
      monthly: "$9.99",
      yearly: "$119.88",
    });
  });
  it("invalid price or interval gives null", () => {
    expect(previewCost("abc", "USD", "monthly", 1)).toBeNull();
    expect(previewCost("", "USD", "monthly", 1)).toBeNull();
    expect(previewCost("1,50", "USD", "monthly", 1)).toBeNull();
    expect(previewCost("10", "USD", "custom", NaN)).toBeNull();
    expect(previewCost("10", "USD", "custom", 0)).toBeNull();
  });
});
