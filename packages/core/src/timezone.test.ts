import { describe, expect, test } from "vitest";
import { isValidTimezone, localToUtc } from "./timezone";

const iso = (d: string, h: number, m: number, tz: string) => localToUtc(d, h, m, tz).toISOString();

describe("timezone", () => {
  test("fixed offset zone", () => {
    expect(iso("2026-12-01", 9, 0, "Asia/Kuala_Lumpur")).toBe("2026-12-01T01:00:00.000Z");
  });
  test("DST offsets", () => {
    expect(iso("2026-11-01", 9, 0, "America/New_York")).toBe("2026-11-01T14:00:00.000Z");
    expect(iso("2026-03-08", 9, 0, "America/New_York")).toBe("2026-03-08T13:00:00.000Z");
  });
  test("gap", () => {
    expect(iso("2027-03-28", 1, 30, "Europe/London")).toBe("2027-03-28T01:30:00.000Z");
  });
  test("overlap picks first", () => {
    expect(iso("2026-11-01", 1, 30, "America/New_York")).toBe("2026-11-01T05:30:00.000Z");
  });
  test("bad input", () => {
    expect(() => localToUtc("2026-12-01", 9, 0, "Mars/Base")).toThrow(RangeError);
    expect(isValidTimezone("Mars/Base")).toBe(false);
    expect(isValidTimezone("Europe/London")).toBe(true);
    expect(() => localToUtc("2026-02-30", 9, 0, "UTC")).toThrow(RangeError);
    expect(() => localToUtc("2026-02-20", 24, 0, "UTC")).toThrow(RangeError);
  });
});
