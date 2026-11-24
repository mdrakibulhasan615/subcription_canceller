import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { profileSettingsSchema } from "@app/core";
import { describedBy, parseSettingsForm, toState, type SettingsState } from "./form-utils";
import { SettingsForm } from "./settings-form";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const base = {
  display_name: "",
  timezone: "UTC",
  currency: "USD",
  default_stop_days_before: "3",
  reminder_days: "7, 3, 1",
  reminder_hour: "9",
  email_reminders: "on",
};
const parses = (o: Record<string, string>) =>
  profileSettingsSchema.safeParse(parseSettingsForm(form(o)));

describe("parseSettingsForm", () => {
  it("W7 parses a list; rejects ; and missing keys", () => {
    const ok = parses(base);
    expect(ok.success && ok.data.reminder_days).toEqual([7, 3, 1]);
    expect(parses({ ...base, reminder_days: "7;3" }).success).toBe(false);
    expect(parses({ ...base, reminder_hour: "" }).success).toBe(false);
    expect(profileSettingsSchema.safeParse(parseSettingsForm(new FormData())).success).toBe(false);
  });

  it("parses the email checkbox: on is true, missing is false", () => {
    const on = parses(base);
    expect(on.success && on.data.email_reminders).toBe(true);
    const { email_reminders: _omit, ...rest } = base;
    void _omit;
    const off = parses(rest);
    expect(off.success && off.data.email_reminders).toBe(false);
  });
});

describe("toState", () => {
  it("maps results", () => {
    expect(toState({ ok: true }, {})).toEqual({ status: "saved" });
    expect(toState({ ok: false, error: "rebuild_failed" }, {})).toMatchObject({
      message: "Settings saved. Reminders could not be updated. Try Save again.",
    });
  });
});

describe("markup", () => {
  const html = (initialState?: SettingsState) =>
    renderToStaticMarkup(
      createElement(SettingsForm, {
        action: async (): Promise<SettingsState> => ({ status: "saved" }),
        initial: base,
        initialState,
      }),
    );

  it("W8 every control has a label", () => {
    const h = html();
    for (const n of Object.keys(base)) {
      expect(h).toContain(`for="${n}"`);
      expect(h).toContain(`id="${n}"`);
    }
    expect(h).toContain('role="status"');
    expect(h).toContain("checked");
  });

  it("shows the checkbox unchecked when email_reminders is off", () => {
    const h = renderToStaticMarkup(
      createElement(SettingsForm, {
        action: async (): Promise<SettingsState> => ({ status: "saved" }),
        initial: { ...base, email_reminders: "" },
      }),
    );
    expect(h).toMatch(/<input[^>]*id="email_reminders"/);
    expect(h).not.toMatch(/<input[^>]*id="email_reminders"[^>]*checked/);
    expect(h).toContain("In-app reminders stay on.");
  });

  it("W8 errors are linked with aria-describedby and the summary lists 2+", () => {
    const h = html({
      status: "error",
      message: null,
      fieldErrors: { reminder_hour: "Bad hour", reminder_days: "Bad days" },
      values: {},
    });
    expect(h).toContain('aria-describedby="reminder_days-help reminder_days-error"');
    expect(h).toContain('aria-describedby="reminder_hour-error"');
    expect(h).toContain('id="reminder_hour-error"');
    expect(h).toContain("Fix these fields:");
    expect(describedBy("x", false, false)).toBeUndefined();
  });
});
