import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IMPORT_COLUMNS,
  addDays,
  readImportTable,
  stopDateWarnings,
  type ImportColumn,
  type ImportError,
  type ProfileSettings,
} from "@app/core";
import { looksLikeCardNumber } from "./card-guard";
import { rateLimit } from "./rate-limit";
import {
  CARD_MESSAGE,
  createSubDb,
  parseSubForm,
  safeRebuild,
  todayIn,
  type SubDb,
  type SubFull,
  type SubWrite,
} from "./subscriptions";

export const MAX_SUBS = 500;

export interface ImportDb extends SubDb {
  /** One insert call: all rows or none. */
  insertSubs(rows: (SubWrite & { user_id: string })[]): Promise<number>;
}

export interface PreviewRow {
  rowNumber: number;
  name: string;
  state: "valid" | "invalid" | "duplicate";
  reasons: string[];
  warnings: string[];
}
export interface PreviewOk {
  ok: true;
  rows: PreviewRow[];
  counts: { valid: number; invalid: number; duplicate: number };
  ignoredColumns: string[];
}
export type CommitResult =
  | { ok: true; imported: number; skipped: number; remindersOk: boolean }
  | {
      ok: false;
      error: "rate_limited" | "server" | "nothing_to_import" | "file" | "too_many";
      message: string;
      retryAfterSec?: number;
    };

export type ImportState =
  | { status: "idle" }
  | { status: "preview"; preview: PreviewOk }
  | { status: "done"; result: Extract<CommitResult, { ok: true }> }
  | { status: "error"; message: string };

export const FILE_MESSAGES: Record<ImportError, string> = {
  empty: "The file has no subscriptions. Add a header row and at least one data row.",
  too_large: "The file is larger than 200 KB. Split it into smaller files.",
  too_many_rows: "The file has more than 200 rows. Split it into smaller files.",
  missing_columns: "The file is missing required columns.",
  bad_quotes: "A quoted cell is not closed. Check the quotes and try again.",
  bad_encoding: "The file is not UTF-8. Save it as CSV UTF-8 and try again.",
};
export const AUTH_MESSAGE = "Your session ended. Sign in again.";

export function resultMessage(r: Extract<CommitResult, { ok: true }>): string {
  const base = `Imported ${r.imported}. Skipped ${r.skipped} (invalid or already in your list).`;
  return r.remindersOk
    ? base
    : `Imported ${r.imported}. Reminders could not be updated. Save any subscription to retry.`;
}

const keyOf = (
  s: Pick<
    SubFull,
    "name" | "price_minor" | "currency" | "billing_cycle" | "billing_interval" | "next_renewal_date"
  >,
) =>
  [
    s.name.trim().toLowerCase(),
    s.price_minor,
    s.currency,
    s.billing_cycle,
    s.billing_interval,
    s.next_renewal_date,
  ].join("|");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_COLUMNS = new Set(["next_renewal_date", "stop_date"]);

interface Analysis {
  rows: PreviewRow[];
  toInsert: SubWrite[];
  existing: number;
  profile: ProfileSettings;
  counts: PreviewOk["counts"];
  ignoredColumns: string[];
}

async function analyze(
  db: SubDb,
  userId: string,
  csv: string,
  now: Date,
): Promise<Analysis | { error: "file" | "server"; message: string }> {
  const table = readImportTable(csv);
  if (!table.ok) {
    const message =
      table.error === "missing_columns" && table.missing
        ? `The file is missing required columns: ${table.missing.join(", ")}.`
        : FILE_MESSAGES[table.error];
    return { error: "file", message };
  }
  let profile: ProfileSettings | null;
  let existingSubs: SubFull[] | undefined;
  try {
    [profile, existingSubs] = await Promise.all([db.getProfile(userId), db.listSubs(userId)]);
  } catch {
    profile = null;
  }
  if (!profile || !existingSubs) {
    return { error: "server", message: "The file could not be checked. Please try again." };
  }
  const today = todayIn(profile.timezone, now);
  const seen = new Map<string, number>();
  const existingKeys = new Set(existingSubs.map(keyOf));
  const rows: PreviewRow[] = [];
  const toInsert: SubWrite[] = [];
  const counts = { valid: 0, invalid: 0, duplicate: 0 };
  for (const { rowNumber, cells } of table.rows) {
    const fd = new FormData();
    for (const c of IMPORT_COLUMNS) fd.set(c, cells[c]);
    if (!cells.currency) fd.set("currency", profile.currency);
    const name = cells.name;
    // A card number in the name is rejected and never echoed in the preview.
    if (looksLikeCardNumber(name)) {
      counts.invalid++;
      rows.push({
        rowNumber,
        name: "",
        state: "invalid",
        reasons: [`name: ${CARD_MESSAGE}`],
        warnings: [],
      });
      continue;
    }
    const parsed = parseSubForm(fd, profile);
    if (!parsed.ok) {
      const reasons = Object.entries(parsed.fieldErrors).map(([f, m]) => {
        const v = cells[f as ImportColumn] ?? "";
        const hint = DATE_COLUMNS.has(f) && v && !DATE_RE.test(v) ? " Use YYYY-MM-DD." : "";
        return `${f}: ${m}${hint && !m.endsWith(".") ? "." : ""}${hint}`;
      });
      counts.invalid++;
      rows.push({ rowNumber, name, state: "invalid", reasons, warnings: [] });
      continue;
    }
    const d = parsed.data;
    const key = keyOf(d);
    const firstRow = seen.get(key);
    const dupReason = existingKeys.has(key)
      ? "Already in your list"
      : firstRow !== undefined
        ? `Same as row ${firstRow}`
        : null;
    if (dupReason) {
      counts.duplicate++;
      rows.push({
        rowNumber,
        name: d.name,
        state: "duplicate",
        reasons: [dupReason],
        warnings: [],
      });
      continue;
    }
    seen.set(key, rowNumber);
    const warnings: string[] = [];
    if (stopDateWarnings(d, today).includes("stop_in_past")) {
      warnings.push("No stop-date reminder will be sent");
    }
    if (d.next_renewal_date < today) warnings.push("The renewal date has passed");
    counts.valid++;
    toInsert.push(d);
    rows.push({ rowNumber, name: d.name, state: "valid", reasons: [], warnings });
  }
  return {
    rows,
    toInsert,
    existing: existingSubs.length,
    profile,
    counts,
    ignoredColumns: table.ignoredColumns,
  };
}

export async function previewImport(
  db: SubDb,
  userId: string,
  csv: string,
  now: Date,
): Promise<PreviewOk | { ok: false; message: string }> {
  try {
    const a = await analyze(db, userId, csv, now);
    if ("error" in a) return { ok: false, message: a.message };
    return { ok: true, rows: a.rows, counts: a.counts, ignoredColumns: a.ignoredColumns };
  } catch {
    return { ok: false, message: "The file could not be checked. Please try again." };
  }
}

export async function commitImport(
  db: ImportDb,
  userId: string,
  csv: string,
  now: Date,
): Promise<CommitResult> {
  // shortcut: in-memory limiter per instance, upgrade if abused
  const rl = rateLimit(`import:${userId}`);
  if (!rl.ok) {
    return {
      ok: false,
      error: "rate_limited",
      message: "Too many imports. Please wait a few minutes and try again.",
      retryAfterSec: rl.retryAfterSec,
    };
  }
  let a;
  try {
    a = await analyze(db, userId, csv, now); // never trust the earlier preview
  } catch {
    return { ok: false, error: "server", message: "Nothing was imported. Try again." };
  }
  if ("error" in a) {
    return a.error === "file"
      ? { ok: false, error: "file", message: a.message }
      : { ok: false, error: "server", message: "Nothing was imported. Try again." };
  }
  if (a.toInsert.length === 0) {
    return {
      ok: false,
      error: "nothing_to_import",
      message: "Nothing to import. Every row is invalid or already in your list.",
    };
  }
  if (a.existing + a.toInsert.length > MAX_SUBS) {
    return {
      ok: false,
      error: "too_many",
      message: `You can keep up to ${MAX_SUBS} subscriptions. Remove some, or import fewer rows.`,
    };
  }
  // shortcut: no DB unique key, so two parallel requests could double-insert. Upgrade with a unique index.
  let imported: number;
  try {
    imported = await db.insertSubs(a.toInsert.map((r) => ({ ...r, user_id: userId })));
  } catch {
    return { ok: false, error: "server", message: "Nothing was imported. Try again." };
  }
  const rebuilt = await safeRebuild(db, userId, a.profile, now);
  return {
    ok: true,
    imported,
    skipped: a.rows.length - a.toInsert.length,
    remindersOk: rebuilt.ok,
  };
}

export function createImportDb(sb: SupabaseClient): ImportDb {
  return {
    ...createSubDb(sb),
    async insertSubs(rows) {
      const { data, error } = await sb.from("subscriptions").insert(rows).select("id");
      if (error) throw error;
      return data?.length ?? 0;
    },
  };
}

/** Template file text: BOM, header, two example rows with renewal dates 30 days from today. */
export function templateCsv(today: string): string {
  const d = addDays(today, 30);
  return [
    "name,price,currency,billing_cycle,next_renewal_date,stop_date,category,payment_method_type,card_nickname,cancel_url,notes",
    `Netflix,15.99,USD,monthly,${d},,Streaming,wise,Wise card for streaming,https://www.netflix.com/cancelplan,`,
    `Domain name,12.00,USD,yearly,${d},,Work,none,,,Renews each year`,
    "",
  ].join("\r\n");
}
