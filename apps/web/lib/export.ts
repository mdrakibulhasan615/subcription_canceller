export const EXPORT_SCHEMA_VERSION = 1;

type Row = Record<string, unknown>;

export type ExportRows = {
  userId: string;
  profile: Row | null;
  subscriptions: Row[];
  reminders: Row[];
  feedback: Row[];
  audit_log: Row[];
  push_subscriptions: Row[];
};

export function buildJsonExport(rows: ExportRows, now: Date) {
  return {
    schema_version: EXPORT_SCHEMA_VERSION,
    exported_at: now.toISOString(),
    user_id: rows.userId,
    profile: rows.profile,
    subscriptions: rows.subscriptions,
    reminders: rows.reminders,
    feedback: rows.feedback,
    audit_log: rows.audit_log,
    push_subscriptions: rows.push_subscriptions,
  };
}

/** Stops spreadsheet formula injection: a leading = + - @ TAB or CR gets a quote prefix. */
export function neutralizeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** Strings are neutralised first, then quoted when needed. Numbers pass as they are. */
export function csvEscape(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string") return String(v);
  const s = neutralizeCell(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const SUBSCRIPTION_CSV_HEADER = [
  "name",
  "category",
  "price",
  "currency",
  "billing_cycle",
  "billing_interval",
  "next_renewal_date",
  "cancel_by_date",
  "stop_date",
  "is_trial",
  "trial_end_date",
  "payment_method_type",
  "card_nickname",
  "cancel_url",
  "notes",
  "created_at",
  "archived_at",
] as const;

type Cell = string | number | boolean | null | undefined;

export function subscriptionsToCsv(rows: Row[]): string {
  const lines = [SUBSCRIPTION_CSV_HEADER.join(",")];
  for (const r of rows) {
    const cells = SUBSCRIPTION_CSV_HEADER.map((col) => {
      // All four supported currencies have 2 decimals. Price is a number: never prefixed.
      if (col === "price") {
        return typeof r.price_minor === "number" ? r.price_minor / 100 : null;
      }
      return r[col] as Cell;
    });
    lines.push(cells.map(csvEscape).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
