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

const row = (o: Partial<ClaimedReminder> = {}): ClaimedReminder => ({
  id: "r1",
  userId: "u1",
  type: "stop_date",
  channel: "in_app",
  userEmail: "a@example.com",
  subName: "Netflix",
  subInactive: false,
  attempts: 0,
  fireAt: "2026-11-24T09:00:00.000Z",
  ...o,
});

// Fake db that mirrors the SQL retry rule: attempts + 1 >= 3 gives failed.
function fakeDb(rows: ClaimedReminder[]) {
  const marks: { id: string; outcome: Outcome; error?: string }[] = [];
  const db: SenderDb = {
    claim: () => Promise.resolve(rows),
    mark: (id, outcome, error) => {
      marks.push({ id, outcome, error });
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
    expect(marks).toEqual([{ id: "r1", outcome: "sent", error: undefined }]);
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
    db.mark = (id, o, e) => (id === "a" ? Promise.reject(new Error("db")) : mark(id, o, e));
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

describe("alertFounder", () => {
  it("sends to the founder address and throws when it is unset", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await alertFounder({ send }, "f@example.com").alert(row(), "boom");
    expect(send.mock.calls[0]![0].userEmail).toBe("f@example.com");
    await expect(alertFounder({ send }, undefined).alert(row(), "boom")).rejects.toThrow();
  });
});
