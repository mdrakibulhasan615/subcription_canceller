export const BILLING_CYCLES = ["weekly", "monthly", "quarterly", "yearly", "custom"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
// For custom, interval is a number of DAYS.
export type Billing = { cycle: BillingCycle; interval: number };

const PER_YEAR: Record<BillingCycle, number> = {
  weekly: 365 / 7,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
  custom: 365,
};

function exactYearly(price: number, b: Billing): number {
  if (!Number.isInteger(b.interval) || b.interval < 1) {
    throw new RangeError(`Bad interval: ${b.interval}`);
  }
  return (price * PER_YEAR[b.cycle]) / b.interval;
}

const roundHalfUp = (n: number) => Math.floor(n + 0.5);

export const yearlyMinor = (price: number, b: Billing) => roundHalfUp(exactYearly(price, b));
export const monthlyMinor = (price: number, b: Billing) => roundHalfUp(exactYearly(price, b) / 12);
