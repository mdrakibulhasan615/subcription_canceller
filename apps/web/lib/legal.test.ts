import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, LEGAL_UPDATED, PRIVACY, TERMS } from "./legal";

const text = (s: typeof PRIVACY) =>
  s.flatMap((x) => [x.heading, ...x.paragraphs, ...(x.bullets ?? [])]).join("\n");

describe("legal text", () => {
  it("has an ISO date and a contact email", () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CONTACT_EMAIL).toContain("@");
    // Flags the placeholder: fails the go-live check when no env is set.
    expect(CONTACT_EMAIL === "contact@example.com").toBe(!process.env.NEXT_PUBLIC_CONTACT_EMAIL);
  });

  it("privacy names every data item and subprocessor", () => {
    const t = text(PRIVACY);
    for (const k of [
      "email address",
      "sign-in method",
      "time zone",
      "reminder hour",
      "default stop days",
      "currency",
      "card nickname",
      "never ask for card numbers",
      "waitlist",
      "do not store your IP",
      "events table",
      "feedback table",
      "audit_log table",
      "no cookies and no ad trackers",
      "Supabase",
      "Vercel",
      "Resend",
      "Sentry",
      "cross-border",
      "Google",
      "sign-in session cookie",
      "JSON and as CSV",
      "at once",
      "backups for a short time",
      "do not link to your bank",
    ]) {
      expect(t, k).toContain(k);
    }
  });

  it("terms say the key warnings", () => {
    const t = text(TERMS);
    for (const k of [
      "does not cancel your subscription with the merchant",
      "does not cancel a subscription",
      "can still try to charge",
      "unpaid debt",
      "do not give financial advice",
      "best-effort",
      "as is",
      "Apple and Google",
    ]) {
      expect(t, k).toContain(k);
    }
  });

  it("uses no banned phrases", () => {
    for (const t of [text(PRIVACY), text(TERMS)].map((x) => x.toLowerCase())) {
      expect(t).not.toContain("subscription cancelled");
      expect(t).not.toContain("cancelled");
      expect(t).not.toContain("guarantee");
      expect(t).not.toContain("payments stop on the date you set");
    }
  });
});
