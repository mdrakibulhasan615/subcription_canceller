import {
  formatMoney,
  monthlyMinor,
  toMinor,
  yearlyMinor,
  type BillingCycle,
  type Currency,
} from "@app/core";

/** Formatted monthly and yearly cost, or null when the price or interval is not valid yet. */
export function previewCost(
  priceStr: string,
  currency: Currency,
  cycle: BillingCycle,
  interval: number,
): { monthly: string; yearly: string } | null {
  let minor: number;
  try {
    minor = toMinor(priceStr.trim(), currency);
  } catch {
    return null;
  }
  const n = cycle === "custom" ? interval : 1;
  if (!Number.isInteger(n) || n < 1 || n > 365) return null;
  const b = { cycle, interval: n };
  return {
    monthly: formatMoney(monthlyMinor(minor, b), currency),
    yearly: formatMoney(yearlyMinor(minor, b), currency),
  };
}
