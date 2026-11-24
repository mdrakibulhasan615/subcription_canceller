export const CURRENCIES = ["USD", "MYR", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Money = { minor: number; currency: Currency };

export function toMinor(amount: string, currency: Currency): number {
  if (!CURRENCIES.includes(currency)) throw new RangeError(`Bad currency: ${currency}`);
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new RangeError(`Bad amount: ${amount}`);
  const [whole = "0", frac = ""] = amount.split(".");
  const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Amount too large: ${amount}`);
  return minor;
}

export function formatMoney(minor: number, currency: Currency, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minor / 100);
}

export function sumByCurrency(items: Money[]): Partial<Record<Currency, number>> {
  const out: Partial<Record<Currency, number>> = {};
  for (const { minor, currency } of items) out[currency] = (out[currency] ?? 0) + minor;
  return out;
}
