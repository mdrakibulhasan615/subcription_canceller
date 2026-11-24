import { describe, expect, it } from "vitest";
import { renderFounderAlert, renderReminderEmail } from "./email-template";
import type { ClaimedReminder } from "./handler";

const o = { appUrl: "https://app.example.com/", brand: "StopDate" };
const row = (p: Partial<ClaimedReminder> = {}): ClaimedReminder => ({
  id: "r1",
  subscriptionId: "s1",
  userId: "u1",
  type: "stop_date",
  channel: "email",
  userEmail: "a@example.com",
  subName: "Netflix",
  subInactive: false,
  attempts: 0,
  fireAt: "2026-12-09T09:00:00.000Z",
  cancelUrl: "https://netflix.com/cancel",
  priceMinor: 1599,
  currency: "USD",
  timezone: "UTC",
  stopDate: "2026-12-12",
  nextRenewalDate: "2026-12-15",
  trialEndDate: null,
  emailReminders: true,
  ...p,
});

describe("renderReminderEmail", () => {
  it("has the subject, required sentences and links in text and html", () => {
    const e = renderReminderEmail(row(), o);
    expect(e.subject).toBe("Netflix: payments stop on 12 Dec 2026");
    for (const body of [e.text, e.html]) {
      const b = body.toLowerCase();
      expect(b).toContain("payments stop on 12 dec 2026");
      expect(b).toContain("freeze or close your card a few days before the renewal date, not on it");
      expect(b).toContain("blocking a card does not cancel the subscription");
      expect(body).toContain("https://netflix.com/cancel");
      expect(body).toContain("https://app.example.com/app/subscriptions");
      expect(body).toContain("https://app.example.com/app/settings");
      expect(b).not.toContain("cancelled");
    }
    expect(e.text).toContain("$15.99");
  });

  it("drops a javascript: or empty cancel link", () => {
    for (const cancelUrl of ["javascript:alert(1)", "  ", null, "ftp://x.com"]) {
      const e = renderReminderEmail(row({ cancelUrl }), o);
      expect(e.text).not.toContain("Cancel link");
      expect(e.html).not.toContain("javascript");
      expect(e.html).not.toContain("Cancel with Netflix</a>");
    }
  });

  it("escapes html in the name and the link", () => {
    const e = renderReminderEmail(
      row({ subName: "<script>x</script>", cancelUrl: 'https://a.com/"><img>' }),
      o,
    );
    expect(e.html).not.toContain("<script>");
    expect(e.html).not.toContain('"><img>');
    expect(e.html).toContain("&lt;script&gt;");
  });

  it("uses the key date and own wording by type", () => {
    const r = renderReminderEmail(row({ type: "renewal" }), o);
    expect(r.subject).toBe("Netflix: renews on 15 Dec 2026");
    expect(r.text).toContain("Netflix renews on 15 Dec 2026. To stop payments, freeze or close your card");
    const t = renderReminderEmail(row({ type: "trial_end", trialEndDate: "2026-12-10" }), o);
    expect(t.subject).toBe("Netflix: free trial ends on 10 Dec 2026");
    expect(t.text).toContain("The free trial ends on 10 Dec 2026. Payments can start on that date.");
    for (const e of [r, t]) {
      expect((e.subject + e.text + e.html).toLowerCase()).not.toContain("payments stop");
      expect(e.text).toContain("Blocking a card does not cancel the subscription");
    }
    const n = renderReminderEmail(row({ type: "trial_end", trialEndDate: null }), o);
    expect(n.text).toContain("Check this subscription.");
  });

  it("drops a cancel link with user:pass@", () => {
    const e = renderReminderEmail(row({ cancelUrl: "https://netflix.com@evil.com/x" }), o);
    expect(e.text).not.toContain("evil.com");
  });
});

describe("renderFounderAlert", () => {
  it("has ids and error only", () => {
    const e = renderFounderAlert(row({ attempts: 2 }), "resend 500", o);
    expect(e.text).toContain("Reminder id: r1");
    expect(e.text).toContain("Error: resend 500");
    expect(e.text).not.toContain("a@example.com");
    expect(e.text).not.toContain("Netflix");
  });
});
