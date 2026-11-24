import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ProfileSettings } from "@app/core";
import type { DbLike } from "../../../lib/profile-settings";

vi.mock("./actions", () => ({ saveOnboardingStep: async () => {} }));

import { buildStepInput, runStep } from "./steps";
import { OnboardingView, parseErrors, parseStep } from "./view";
import { Nudge } from "../nudge";

const profile: ProfileSettings = {
  display_name: null,
  timezone: "UTC",
  currency: "USD",
  default_stop_days_before: 3,
  reminder_days: [7, 3, 1],
  reminder_hour: 9,
  email_reminders: true,
};

function fakeDb(p: ProfileSettings | null = profile) {
  const saved: ProfileSettings[] = [];
  const db: DbLike = {
    getProfile: async () => p,
    updateProfile: async (_id, s) => void saved.push(s),
    listSubsWithReminders: async () => ({ subs: [], reminders: [] }),
    insertReminder: async () => null,
    setReminderStatus: async () => {},
  };
  return { db, saved };
}
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const run = async (step: 1 | 2, o: Record<string, string>, p?: ProfileSettings | null) => {
  const t = fakeDb(p);
  const to = await runStep(t.db, "u", step, fd(o), new Date("2026-06-01T00:00:00Z"));
  return { to, saved: t.saved };
};

describe("onboarding steps", () => {
  it("buildStepInput takes only the fields of this step", () => {
    const i = buildStepInput(profile, fd({ timezone: "Asia/Tokyo", reminder_hour: "3" }), 1);
    expect(i.timezone).toBe("Asia/Tokyo");
    expect(i.reminder_hour).toBe(9);
  });

  it("6. step 1 saves tz and currency only", async () => {
    const r = await run(1, { timezone: "Asia/Kuala_Lumpur", currency: "MYR" });
    expect(r.to).toBe("/app/onboarding?step=2");
    expect(r.saved[0]).toMatchObject({
      timezone: "Asia/Kuala_Lumpur",
      currency: "MYR",
      reminder_hour: 9,
    });
  });

  it("7. bad timezone redisplays step 1 and saves nothing", async () => {
    const r = await run(1, { timezone: "Mars/Base", currency: "USD" });
    expect(r.to).toBe("/app/onboarding?step=1&err=timezone");
    expect(r.saved).toHaveLength(0);
  });

  it("8. step 2 saves days, hour, email off", async () => {
    const r = await run(2, {
      default_stop_days_before: "5",
      reminder_days: "7, 3, 1",
      reminder_hour: "8",
    });
    expect(r.to).toBe("/app/onboarding?step=3");
    expect(r.saved[0]).toMatchObject({ reminder_hour: 8, email_reminders: false, timezone: "UTC" });
  });

  it("9. bad days shows the reminder days error", async () => {
    const r = await run(2, {
      default_stop_days_before: "3",
      reminder_days: "7;3",
      reminder_hour: "8",
    });
    expect(r.to).toBe("/app/onboarding?step=2&err=reminder_days");
  });

  it("no profile or a throwing db gives err=server", async () => {
    expect((await run(1, {}, null)).to).toBe("/app/onboarding?step=1&err=server");
    const { db } = fakeDb();
    db.getProfile = async () => {
      throw new Error("x");
    };
    expect(await runStep(db, "u", 2, fd({}), new Date())).toBe("/app/onboarding?step=2&err=server");
  });
});

describe("onboarding view", () => {
  const html = (step: 1 | 2 | 3, err?: string) =>
    renderToStaticMarkup(h(OnboardingView, { step, profile, errors: parseErrors(step, err) }));

  it("parseStep and parseErrors ignore junk", () => {
    expect(parseStep("9")).toBe(1);
    expect(parseStep("3")).toBe(3);
    expect(parseErrors(1, "timezone,reminder_hour,<b>").fields).toEqual(["timezone"]);
    expect(parseErrors(1, undefined)).toEqual({ fields: [], message: null });
  });

  it("11. step 3 links", () => {
    const h = html(3);
    expect(h).toContain("Step 3 of 3");
    expect(h).toContain('href="/app/subscriptions/new"');
    expect(h).toContain('href="/app/subscriptions/new?trial=1"');
    expect(h).toContain('href="/app/import"');
    expect(h).toContain('href="/app"');
    expect(h.match(/<h1/g)).toHaveLength(1);
  });

  it("steps 1 and 2 show the step, one h1, a skip link and the error text", () => {
    const a = html(1, "timezone");
    expect(a).toContain("Step 1 of 3");
    expect(a).toContain("Enter a valid timezone");
    expect(a).toContain('role="alert"');
    expect(a).toContain("step=2");
    const b = html(2);
    expect(b).toContain("Step 2 of 3");
    expect(b).toContain("Send reminders by email");
    expect(b).not.toContain('role="alert"');
    expect(b.match(/<h1/g)).toHaveLength(1);
  });
});

describe("dashboard nudge", () => {
  it("13. shows for 1 or 2 only", () => {
    expect(renderToStaticMarkup(h(Nudge, { n: 2 }))).toContain("You have 2 of 3 subscriptions");
    expect(renderToStaticMarkup(h(Nudge, { n: 1 }))).toContain("/app/import");
    expect(renderToStaticMarkup(h(Nudge, { n: 0 }))).toBe("");
    expect(renderToStaticMarkup(h(Nudge, { n: 3 }))).toBe("");
  });
});
