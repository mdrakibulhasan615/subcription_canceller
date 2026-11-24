import { describe, expect, it } from "vitest";
import { needsReminderRebuild, profileSettingsSchema } from "./profile";

const ok = {
  display_name: "Sam",
  timezone: "Asia/Kuala_Lumpur",
  currency: "MYR",
  default_stop_days_before: 3,
  reminder_days: [7, 3, 1],
  reminder_hour: 9,
};
const bad = (patch: object) => {
  const r = profileSettingsSchema.safeParse({ ...ok, ...patch });
  return r.success ? [] : r.error.issues.map((i) => i.path[0]);
};

describe("profileSettingsSchema", () => {
  it("C1 parses valid input; dedupes and sorts days", () => {
    expect(profileSettingsSchema.parse(ok)).toEqual(ok);
    expect(
      profileSettingsSchema.parse({ ...ok, reminder_days: [3, 7, 7, 1] }).reminder_days,
    ).toEqual([7, 3, 1]);
  });
  it("C2 timezone", () => {
    expect(bad({ timezone: "Mars/Base" })).toEqual(["timezone"]);
    expect(bad({ timezone: "Asia/Kuala_Lumpur" })).toEqual([]);
    expect(bad({ timezone: "UTC".padEnd(65, "x") })).toContain("timezone");
  });
  it("C3 invalid values fail on the right field", () => {
    expect(bad({ currency: "JPY" })).toEqual(["currency"]);
    expect(bad({ reminder_hour: 24 })).toEqual(["reminder_hour"]);
    expect(bad({ reminder_hour: -1 })).toEqual(["reminder_hour"]);
    for (const v of [61, -1, 1.5])
      expect(bad({ default_stop_days_before: v })).toEqual(["default_stop_days_before"]);
    for (const v of [[], [0], [-1], [1.5], [1, 2, 3, 4, 5, 6], [366]])
      expect(bad({ reminder_days: v })).toEqual(["reminder_days"]);
  });
  it("C3 boundaries pass", () => {
    expect(bad({ default_stop_days_before: 0 })).toEqual([]);
    expect(bad({ default_stop_days_before: 60 })).toEqual([]);
    expect(bad({ reminder_hour: 0 })).toEqual([]);
    expect(bad({ reminder_hour: 23 })).toEqual([]);
    expect(bad({ reminder_days: [1] })).toEqual([]);
    expect(bad({ reminder_days: [365, 5, 4, 3, 2] })).toEqual([]);
  });
  it("C4 display name", () => {
    expect(profileSettingsSchema.parse({ ...ok, display_name: "  " }).display_name).toBeNull();
    expect(bad({ display_name: "x".repeat(81) })).toEqual(["display_name"]);
  });
});

describe("needsReminderRebuild", () => {
  const a = { timezone: "UTC", reminder_hour: 9, reminder_days: [7, 3, 1] };
  it("C5", () => {
    expect(needsReminderRebuild(a, { ...a, timezone: "Asia/Tokyo" })).toBe(true);
    expect(needsReminderRebuild(a, { ...a, reminder_hour: 8 })).toBe(true);
    expect(needsReminderRebuild(a, { ...a, reminder_days: [7, 3] })).toBe(true);
    expect(needsReminderRebuild(a, { ...a, reminder_days: [1, 3, 7] })).toBe(false);
  });
});
