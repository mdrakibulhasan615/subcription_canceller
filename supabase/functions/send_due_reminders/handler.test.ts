import { describe, expect, it, vi } from "vitest";
import {
  handleRequest,
  runDueReminders,
  secretsMatch,
  type ClaimedReminder,
  type Outcome,
  type SenderDb,
  type Status,
} from "./handler";
import { alertFounder, inAppSender, stubEmailSender } from "./senders";
import type { EmailTransport } from "./resend";

const row = (o: Partial<ClaimedReminder> = {}): ClaimedReminder => ({
  id: "r1",
  subscriptionId: "s1",
  userId: "u1",
  type: "stop_date",
  channel: "in_app",
  userEmail: "a@example.com",
  subName: "Netflix",
  subInactive: false,
  attempts: 0,
  fireAt: "2026-11-24T09:00:00.000Z",
  cancelUrl: null,
  priceMinor: 999,
  currency: "USD",
  timezone: "UTC",
  stopDate: "2026-12-12",
  nextRenewalDate: "2026-12-15",
  trialEndDate: null,
  emailReminders: true,
  ...o,
});

// Fake db that mirrors the SQL retry rule: attempts + 1 >= 3 gives failed.
function fakeDb(rows: ClaimedReminder[]) {
  const marks: { id: string; outcome: Outcome; error?: string; ref?: string }[] = [];
  const db: SenderDb = {
    claim: () => Promise.resolve(rows),
    mark: (id, outcome, error, ref) => {
      marks.push({ id, outcome, error, ref });
      const r = rows.find((x) => x.id === id)!;
      const s: Status =
        outcome === "retry" ? (r.attempts + 1 >= 3 ? "failed" : "pending") : outcome;
      return Promise.resolve(s);
    },
  };
  return { db, marks };
}

const alerter = () => ({ alert: vi.fn().mockResolvedValue(undefined) });

describe("runDueReminders", () => {
  it("counts sent, retried and skipped; skips inactive without sending", async () => {
    const rows = [
      row({ id: "a" }),
      row({ id: "b", channel: "email" }),
      row({ id: "c", subInactive: true }),
    ];
    const { db } = fakeDb(rows);
    const inApp = { send: vi.fn().mockResolvedValue(undefined) };
    const email = { send: vi.fn().mockRejectedValue(new Error("down")) };
    const res = await runDueReminders({
      db,
      senders: { in_app: inApp, email },
      alerter: alerter(),
    });
    expect(res).toEqual({ claimed: 3, sent: 1, retried: 1, failed: 0, skipped: 1 });
    expect(inApp.send).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("alerts once when the third attempt fails", async () => {
    const { db } = fakeDb([row({ channel: "email", attempts: 2 })]);
    const a = alerter();
    const res = await runDueReminders({
      db,
      senders: { email: stubEmailSender },
      alerter: a,
    });
    expect(res.failed).toBe(1);
    expect(a.alert).toHaveBeenCalledTimes(1);
    expect(a.alert).toHaveBeenCalledWith(expect.anything(), "email not configured");
  });

  it("still resolves with right counts when the alerter throws", async () => {
    const { db } = fakeDb([row({ channel: "email", attempts: 2 }), row({ id: "b" })]);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runDueReminders({
      db,
      senders: { email: stubEmailSender, in_app: inAppSender },
      alerter: { alert: () => Promise.reject(new Error("mail down")) },
    });
    spy.mockRestore();
    expect(res).toEqual({ claimed: 2, sent: 1, retried: 0, failed: 1, skipped: 0 });
  });

  it("marks in_app sent with no external call", async () => {
    const { db, marks } = fakeDb([row()]);
    const res = await runDueReminders({ db, senders: { in_app: inAppSender }, alerter: alerter() });
    expect(res.sent).toBe(1);
    expect(marks).toEqual([{ id: "r1", outcome: "sent", error: undefined, ref: undefined }]);
  });

  it("treats a missing sender and a null email as errors", async () => {
    const { db, marks } = fakeDb([
      row({ id: "p", channel: "push" }),
      row({ id: "e", channel: "email", userEmail: null }),
    ]);
    const email = { send: vi.fn() };
    const res = await runDueReminders({ db, senders: { email }, alerter: alerter() });
    expect(res.retried).toBe(2);
    expect(email.send).not.toHaveBeenCalled();
    expect(marks[0]!.error).toMatch(/no sender/);
    expect(marks[1]!.error).toMatch(/no email/);
  });

  it("keeps going when the db throws on one row", async () => {
    const rows = [row({ id: "a" }), row({ id: "b" })];
    const { db } = fakeDb(rows);
    const mark = db.mark;
    db.mark = (id, o, e, f) =>
      id === "a" ? Promise.reject(new Error("db")) : mark(id, o, e, f);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runDueReminders({ db, senders: { in_app: inAppSender }, alerter: alerter() });
    spy.mockRestore();
    expect(res.sent).toBe(1);
  });

  it("returns zeros for an empty claim and caps the batch at 200", async () => {
    const claim = vi.fn().mockResolvedValue([]);
    const res = await runDueReminders({
      db: { claim, mark: vi.fn() },
      senders: {},
      alerter: alerter(),
      batch: 5000,
    });
    expect(res).toEqual({ claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 });
    expect(claim).toHaveBeenCalledWith(200);
  });
});

describe("auth and http", () => {
  it("compares secrets", () => {
    expect(secretsMatch("abc", "abc")).toBe(true);
    expect(secretsMatch("abd", "abc")).toBe(false);
    expect(secretsMatch("abcd", "abc")).toBe(false);
    expect(secretsMatch(null, "abc")).toBe(false);
    expect(secretsMatch("abc", undefined)).toBe(false);
    expect(secretsMatch("", "")).toBe(false);
  });

  it("returns 401 for a wrong or missing secret without running", async () => {
    const run = vi.fn();
    const bad = new Request("http://x", { method: "POST", headers: { "x-cron-secret": "no" } });
    const none = new Request("http://x", { method: "POST" });
    expect((await handleRequest(bad, "yes", run)).status).toBe(401);
    expect((await handleRequest(none, "yes", run)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("returns 405 for non-POST and 200 with counts for a good call", async () => {
    const counts = { claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0 };
    const run = vi.fn().mockResolvedValue(counts);
    expect((await handleRequest(new Request("http://x"), "s", run)).status).toBe(405);
    const ok = await handleRequest(
      new Request("http://x", { method: "POST", headers: { "x-cron-secret": "s" } }),
      "s",
      run,
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(counts);
  });
});

describe("send rules", () => {
  const NOW = () => new Date("2026-11-24T12:00:00Z");

  it("passes the provider ref to mark", async () => {
    const { db, marks } = fakeDb([row({ channel: "email" })]);
    const email = { send: vi.fn().mockResolvedValue("re_123") };
    await runDueReminders({ db, senders: { email }, alerter: alerter(), now: NOW });
    expect(marks).toEqual([{ id: "r1", outcome: "sent", error: undefined, ref: "re_123" }]);
  });

  it("skips an email row when the user opted out, with no send; in_app is unaffected", async () => {
    const { db, marks } = fakeDb([
      row({ id: "e", channel: "email", emailReminders: false }),
      row({ id: "i", channel: "in_app", emailReminders: false }),
    ]);
    const email = { send: vi.fn() };
    const res = await runDueReminders({
      db,
      senders: { email, in_app: inAppSender },
      alerter: alerter(),
      now: NOW,
    });
    expect(email.send).not.toHaveBeenCalled();
    expect(marks.map((m) => [m.id, m.outcome])).toEqual([
      ["e", "skipped"],
      ["i", "sent"],
    ]);
    expect(res.skipped).toBe(1);
  });

  it("skips a row whose key date is past, by type", async () => {
    const { db, marks } = fakeDb([
      row({ id: "a", stopDate: "2026-11-23" }),
      row({ id: "b", type: "renewal", nextRenewalDate: "2026-11-23" }),
      row({ id: "c", type: "trial_end", trialEndDate: "2026-11-23" }),
      row({ id: "d", stopDate: "2026-11-24" }),
      row({ id: "e", type: "trial_end", trialEndDate: null }),
    ]);
    await runDueReminders({ db, senders: { in_app: inAppSender }, alerter: alerter(), now: NOW });
    expect(marks.map((m) => `${m.id}:${m.outcome}`)).toEqual([
      "a:skipped",
      "b:skipped",
      "c:skipped",
      "d:sent",
      "e:sent",
    ]);
  });

  it("uses the user timezone for today", async () => {
    // 2026-11-24 20:00 UTC is already 25 Nov in Kuala Lumpur.
    const { db, marks } = fakeDb([row({ timezone: "Asia/Kuala_Lumpur", stopDate: "2026-11-24" })]);
    await runDueReminders({
      db,
      senders: { in_app: inAppSender },
      alerter: alerter(),
      now: () => new Date("2026-11-24T20:00:00Z"),
    });
    expect(marks[0]!.outcome).toBe("skipped");
  });
});

describe("alertFounder", () => {
  const opts = { appUrl: "https://app.example.com", brand: "StopDate" };
  it("sends a body with ids and error, no user email or name; throws when unset", async () => {
    const sendEmail = vi.fn().mockResolvedValue("id");
    const t: EmailTransport = { sendEmail };
    await alertFounder(t, "f@example.com", opts).alert(row({ attempts: 2 }), "resend 500");
    const m = sendEmail.mock.calls[0]![0];
    expect(m.to).toBe("f@example.com");
    for (const part of ["r1", "stop_date", "in_app", "resend 500", "u1", "s1", "3"]) {
      expect(m.text).toContain(part);
    }
    expect(m.text + m.html + m.subject).not.toContain("a@example.com");
    expect(m.text + m.html + m.subject).not.toContain("Netflix");
    await expect(alertFounder(t, undefined, opts).alert(row(), "boom")).rejects.toThrow();
    await expect(alertFounder(null, "f@example.com", opts).alert(row(), "boom")).rejects.toThrow();
  });
});

describe("failure flow", () => {
  it("three Resend 500s end failed with one alert", async () => {
    const r = row({ channel: "email" });
    const fetchFn = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const { createResendTransport } = await import("./resend");
    const { emailReminderSender } = await import("./senders");
    const transport = createResendTransport({ apiKey: "k", from: "f@x.com", fetch: fetchFn });
    const sender = emailReminderSender(transport, { appUrl: "https://a.com", brand: "StopDate" });
    const a = alerter();
    for (let attempts = 0; attempts < 3; attempts++) {
      const { db } = fakeDb([{ ...r, attempts }]);
      await runDueReminders({
        db,
        senders: { email: sender },
        alerter: a,
        now: () => new Date("2026-11-24T00:00:00Z"),
      });
    }
    expect(a.alert).toHaveBeenCalledTimes(1);
    expect(a.alert).toHaveBeenCalledWith(expect.anything(), "resend 500");
  });
});
