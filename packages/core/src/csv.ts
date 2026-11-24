export const CSV_LIMITS = { maxBytes: 200 * 1024, maxRows: 200 } as const;

export const IMPORT_COLUMNS = [
  "name",
  "price",
  "currency",
  "billing_cycle",
  "billing_interval",
  "next_renewal_date",
  "stop_date",
  "category",
  "cancel_url",
  "payment_method_type",
  "card_nickname",
  "notes",
] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export const REQUIRED_COLUMNS: readonly ImportColumn[] = [
  "name",
  "price",
  "billing_cycle",
  "next_renewal_date",
];

export type ImportError =
  "empty" | "too_large" | "too_many_rows" | "missing_columns" | "bad_quotes" | "bad_encoding";
export type ImportTable =
  | {
      ok: true;
      rows: { rowNumber: number; cells: Record<ImportColumn, string> }[];
      ignoredColumns: string[];
    }
  | { ok: false; error: ImportError; missing?: ImportColumn[] };

/** RFC 4180 parser. Blank lines come back as [""]. An unterminated quote throws RangeError. */
export function parseCsv(text: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let started = false; // true once the current record has any char
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quoted) {
      if (c !== '"') cell += c;
      else if (s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      started = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
      started = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      started = false;
    } else {
      cell += c;
      started = true;
    }
  }
  if (quoted) throw new RangeError("Unterminated quote");
  if (started) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[\s_-]/g, "");
const ALIASES: Record<string, ImportColumn> = {};
for (const [col, names] of Object.entries({
  name: ["service", "subscription"],
  price: ["amount", "cost"],
  billing_cycle: ["cycle", "frequency", "period"],
  next_renewal_date: ["renewal", "renewaldate", "nextbilling", "nextpayment"],
  stop_date: ["stop"],
  card_nickname: ["card"],
  cancel_url: ["url", "cancellink"],
  payment_method_type: ["paymentmethod"],
}) as [ImportColumn, string[]][]) {
  for (const n of names) ALIASES[n] = col;
}
for (const c of IMPORT_COLUMNS) ALIASES[norm(c)] = c;

const CYCLE_ALIASES: Record<string, string> = {
  month: "monthly",
  mo: "monthly",
  annual: "yearly",
  year: "yearly",
  week: "weekly",
  quarter: "quarterly",
};
const PAYMENT_ALIASES: Record<string, string> = {
  wise: "wise",
  privacy: "privacy",
  "privacy.com": "privacy",
  othervirtual: "other_virtual",
  none: "none",
};

/** Delimiter from the header line, ignoring quoted text. Comma wins a tie. */
function detectDelimiter(s: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let q = false;
  for (const c of s) {
    if (c === '"') q = !q;
    else if (!q && (c === "\n" || c === "\r")) break;
    else if (!q && c === ",") commas++;
    else if (!q && c === ";") semis++;
  }
  return semis > commas ? ";" : ",";
}

export function readImportTable(input: string): ImportTable {
  if (new TextEncoder().encode(input).length > CSV_LIMITS.maxBytes) {
    return { ok: false, error: "too_large" };
  }
  if (input.includes("\uFFFD")) return { ok: false, error: "bad_encoding" };
  // Excel adds a "sep=;" first line.
  const text = input.replace(/^\uFEFF/, "").replace(/^sep=.[ \t]*\r?\n/i, "");
  let records: string[][];
  try {
    records = parseCsv(text, detectDelimiter(text));
  } catch {
    return { ok: false, error: "bad_quotes" };
  }
  const isBlank = (r: string[]) => r.every((c) => c.trim() === "");
  const headerAt = records.findIndex((r) => !isBlank(r));
  if (headerAt < 0) return { ok: false, error: "empty" };
  const index = new Map<ImportColumn, number>();
  const ignoredColumns: string[] = [];
  records[headerAt]!.forEach((h, i) => {
    const col = ALIASES[norm(h)];
    if (col && !index.has(col)) index.set(col, i);
    else if (h.trim()) ignoredColumns.push(h.trim());
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !index.has(c));
  if (missing.length) return { ok: false, error: "missing_columns", missing };
  const rows: { rowNumber: number; cells: Record<ImportColumn, string> }[] = [];
  records.forEach((r, i) => {
    if (i <= headerAt || isBlank(r)) return;
    const cells = {} as Record<ImportColumn, string>;
    for (const c of IMPORT_COLUMNS) cells[c] = (r[index.get(c) ?? -1] ?? "").trim();
    const cycle = cells.billing_cycle.toLowerCase();
    cells.billing_cycle = CYCLE_ALIASES[cycle] ?? cycle;
    cells.currency = cells.currency.toUpperCase();
    const pay = PAYMENT_ALIASES[cells.payment_method_type.toLowerCase().replace(/[\s_-]/g, "")];
    if (pay) cells.payment_method_type = pay;
    // Row 1 is the header line, so a row's number is its record position plus 1.
    rows.push({ rowNumber: i + 1, cells });
  });
  if (rows.length === 0) return { ok: false, error: "empty" };
  if (rows.length > CSV_LIMITS.maxRows) return { ok: false, error: "too_many_rows" };
  return { ok: true, rows, ignoredColumns };
}
