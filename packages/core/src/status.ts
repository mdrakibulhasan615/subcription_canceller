import { daysBetween, type IsoDate } from "./dates";

export type SubStatus = "active" | "stopping_soon" | "stopped" | "cancelled";
export type StatusInput = {
  stopDate: IsoDate | null;
  merchantCancelledAt: string | null;
  stopConfirmedAt: string | null;
  archivedAt?: string | null;
};

export function deriveStatus(s: StatusInput, today: IsoDate, soonDays = 7): SubStatus {
  if (s.merchantCancelledAt) return "cancelled";
  if (s.stopConfirmedAt) return "stopped";
  if (!s.stopDate) return "active";
  // A passed, unconfirmed stop date (days < 0) stays stopping_soon (D13).
  return daysBetween(today, s.stopDate) <= soonDays ? "stopping_soon" : "active";
}
