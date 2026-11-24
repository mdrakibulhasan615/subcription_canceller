import {
  CURRENCIES,
  categoryBreakdown,
  countedSubs,
  savings,
  totals,
  upcoming,
  type Currency,
  type PerCurrency,
} from "@app/core";
import { daysLeftText } from "./sub-view";
import { todayIn, type SubDb } from "./subscriptions";

export const SAVINGS_NOTE =
  "Estimate only. This is the yearly cost of subscriptions you stopped or cancelled, if you had kept paying. It is not a promise of savings. Check your card statement.";
export const HONEST_NOTE =
  "Totals use the prices you typed in. Different currencies are not added together. We do not link to your bank. Check your card statement.";

export const skippedText = (n: number) =>
  `${n} ${n === 1 ? "subscription" : "subscriptions"} left out because of a bad billing interval.`;

/** Days-left label for an upcoming date. */
export const dueText = (n: number, hasStop = true) =>
  n === 0 ? "Today" : daysLeftText(n, hasStop);

/** Currencies present in a map, in the fixed CURRENCIES order. */
export const currenciesIn = (m: PerCurrency): Currency[] =>
  CURRENCIES.filter((c) => m[c] !== undefined);

export type DashboardView = {
  today: string;
  totals: ReturnType<typeof totals>;
  upcoming: ReturnType<typeof upcoming>;
  savings: ReturnType<typeof savings>;
  categories: ReturnType<typeof categoryBreakdown>;
  /** All subs, archived too. 0 means show the empty state. */
  total: number;
  /** Subs that count (active or stopping soon). */
  counted: number;
};

export async function loadDashboard(
  db: SubDb,
  userId: string,
  now: Date,
): Promise<DashboardView | "error"> {
  try {
    const [profile, subs] = await Promise.all([db.getProfile(userId), db.listSubs(userId)]);
    const today = todayIn(profile?.timezone ?? "UTC", now);
    return {
      today,
      totals: totals(subs, today),
      upcoming: upcoming(subs, today),
      savings: savings(subs, today),
      categories: categoryBreakdown(subs, today),
      total: subs.length,
      counted: countedSubs(subs, today).length,
    };
  } catch {
    return "error";
  }
}
