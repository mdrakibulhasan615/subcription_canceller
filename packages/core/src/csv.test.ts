import { describe, expect, it } from "vitest";
import { CSV_LIMITS, parseCsv, readImportTable } from "./csv";

const H = "name,price,billing_cycle,next_renewal_date";
const table = (s: string) => readImportTable(s);
const rows = (s: string) => {
  const t = table(s);
  if (!t.ok) throw new Error(t.error);
  return t.rows;
};

describe("parseCsv", () => {
  it("keeps quoted commas, escaped quotes and newlines", () => {
    expect(parseCsv('"Netflix, Premium","say ""hi""","a\nb"', ",")).toEqual([
      ["Netflix, Premium", 'say "hi"', "a\nb"],
    ]);
  });
  it("handles BOM, CRLF and a last row without newline", () => {
    expect(parseCsv("\uFEFFa,b\r\nc,d", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
  it("throws on an unterminated quote", () => {
    expect(() => parseCsv('a,"b', ",")).toThrow(RangeError);
  });
});

describe("readImportTable", () => {
  it("C2 reports missing columns, empty and bad quotes", () => {
    expect(table("name,billing_cycle,next_renewal_date\nA,monthly,2026-12-01")).toEqual({
      ok: false,
      error: "missing_columns",
      missing: ["price"],
    });
    expect(table("")).toMatchObject({ error: "empty" });
    expect(table(H)).toMatchObject({ error: "empty" });
    expect(table(`${H}\n"A,1,monthly,2026-12-01`)).toMatchObject({ error: "bad_quotes" });
    expect(table(`${H}\n\uFFFD,1,monthly,2026-12-01`)).toMatchObject({ error: "bad_encoding" });
  });
  it("C3 limits size and rows", () => {
    const line = "A,1,monthly,2026-12-01\n";
    expect(table(H + "\n" + line.repeat(200))).toMatchObject({ ok: true });
    expect(table(H + "\n" + line.repeat(201))).toMatchObject({ error: "too_many_rows" });
    expect(table(H + "\n" + "x".repeat(CSV_LIMITS.maxBytes))).toMatchObject({
      error: "too_large",
    });
  });
  it("C5 BOM + CRLF, last row without newline, row numbers", () => {
    const r = rows(`\uFEFF${H}\r\nA,1,monthly,2026-12-01\r\n\r\nB,2,monthly,2026-12-02`);
    expect(r.map((x) => [x.rowNumber, x.cells.name])).toEqual([
      [2, "A"],
      [4, "B"],
    ]);
  });
  it("C7 detects a semicolon file, and ignores ; inside quotes", () => {
    expect(rows("name;price;billing_cycle;next_renewal_date\nA;1;monthly;2026-12-01")).toHaveLength(
      1,
    );
    expect(
      rows("sep=;\nname;price;billing_cycle;next_renewal_date\nA;1;monthly;2026-12-01"),
    ).toHaveLength(1);
    expect(rows(`${H}\n"A;B",1,monthly,2026-12-01`)[0]!.cells.name).toBe("A;B");
    expect(
      rows(`name,price,billing_cycle,next_renewal_date,"x;y;z"\nA,1,monthly,2026-12-01`),
    ).toHaveLength(1);
  });
  it("C8 maps aliases and value aliases, lists ignored columns", () => {
    const t = table("Service,Amount,Cycle,Renewal,Colour\nA,1,Annual,2026-12-01,red");
    expect(t).toMatchObject({ ok: true, ignoredColumns: ["Colour"] });
    if (t.ok) {
      expect(t.rows[0]!.cells).toMatchObject({ name: "A", billing_cycle: "yearly", price: "1" });
    }
    const p = rows(`${H},Payment Method\nA,1,mo,2026-12-01,Privacy.com`)[0]!.cells;
    expect(p).toMatchObject({ billing_cycle: "monthly", payment_method_type: "privacy" });
  });
  it("pads short rows and trims long rows", () => {
    const r = rows(`${H}\nA,1\nB,2,monthly,2026-12-01,extra,more`);
    expect(r[0]!.cells.next_renewal_date).toBe("");
    expect(r[1]!.cells.name).toBe("B");
  });
});
