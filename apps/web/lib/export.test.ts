import { describe, expect, it } from "vitest";
import {
  buildJsonExport,
  csvEscape,
  neutralizeCell,
  SUBSCRIPTION_CSV_HEADER,
  subscriptionsToCsv,
} from "./export";

const empty = {
  userId: "u1",
  profile: null,
  subscriptions: [],
  reminders: [],
  feedback: [],
  audit_log: [],
  push_subscriptions: [],
};
const sub = (o: Record<string, unknown>) => ({ price_minor: 1599, ...o });
const dataLines = (csv: string) => csv.slice(1).split("\r\n").slice(1, -1);

describe("export", () => {
  it("1. json has version, ISO date and all keys", () => {
    const j = buildJsonExport(empty, new Date("2026-01-02T03:04:05Z"));
    expect(j.schema_version).toBe(1);
    expect(j.exported_at).toBe("2026-01-02T03:04:05.000Z");
    expect(Object.keys(j)).toEqual([
      "schema_version",
      "exported_at",
      "user_id",
      "profile",
      "subscriptions",
      "reminders",
      "feedback",
      "audit_log",
      "push_subscriptions",
    ]);
  });

  it("4. formula triggers get a quote, plain text and numbers do not", () => {
    for (const v of ["=cmd|' /C calc'!A0", "+1", "-2+3", "@SUM(A1)", "\tx", "\rx"]) {
      expect(neutralizeCell(v), JSON.stringify(v)).toBe(`'${v}`);
    }
    expect(neutralizeCell("Netflix")).toBe("Netflix");
    expect(neutralizeCell("'x")).toBe("'x");
    expect(csvEscape(15.99)).toBe("15.99");
    expect(csvEscape(-5)).toBe("-5");
    const csv = subscriptionsToCsv([sub({ name: "-2+3" }), sub({ name: "Netflix" })]);
    expect(dataLines(csv)[0]!.startsWith("'-2+3,")).toBe(true);
    expect(dataLines(csv)[1]!.startsWith("Netflix,")).toBe(true);
    expect(dataLines(csv)[1]).toContain(",15.99,");
  });

  it("5. quotes, newline, CRLF, header and BOM", () => {
    const csv = subscriptionsToCsv([sub({ name: "N", notes: 'a,"b"\nc' })]);
    expect(csv.startsWith("﻿name,category,price")).toBe(true);
    expect(csv).toContain('"a,""b""\nc"');
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe("﻿" + SUBSCRIPTION_CSV_HEADER.join(","));
  });

  it("5b. null is empty, unicode kept", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape("Café 日本")).toBe("Café 日本");
  });

  it("6. zero rows give a header-only CSV", () => {
    expect(subscriptionsToCsv([])).toBe("﻿" + SUBSCRIPTION_CSV_HEADER.join(",") + "\r\n");
  });
});
