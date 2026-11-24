import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EVENT_NAMES, trackEvent, type EventsClient } from "./events";

const fake = (result: unknown = { error: null }) => {
  const insert = vi.fn(async () => result);
  return { insert, client: { from: () => ({ insert }) } as unknown as EventsClient };
};

describe("trackEvent", () => {
  it("inserts a valid event", async () => {
    const f = fake();
    await trackEvent(f.client, "u1", "csv_imported", { count: 3 });
    expect(f.insert).toHaveBeenCalledWith({
      user_id: "u1",
      name: "csv_imported",
      props: { count: 3 },
    });
  });

  it("defaults to empty props and allows a null user", async () => {
    const f = fake();
    await trackEvent(f.client, null, "waitlist_joined");
    expect(f.insert).toHaveBeenCalledWith({ user_id: null, name: "waitlist_joined", props: {} });
  });

  it("drops invalid or personal props", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fake();
    await trackEvent(f.client, "u1", "app_opened", { email: "a@b.c" });
    await trackEvent(f.client, "u1", "csv_imported", { count: 501 });
    await trackEvent(f.client, "u1", "export_downloaded", { format: "xml" });
    await trackEvent(f.client, "u1", "subscription_added", { has_stop_date: true, name: "x" });
    expect(f.insert).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("a@b.c");
    warn.mockRestore();
  });

  it("accepts a full subscription_added", async () => {
    const f = fake();
    const props = {
      has_stop_date: true,
      is_trial: false,
      payment_method_type: "wise",
      source: "form",
    };
    await trackEvent(f.client, "u1", "subscription_added", props);
    expect(f.insert).toHaveBeenCalledOnce();
  });

  it("resolves when the insert errors, rejects or throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(
      trackEvent(fake({ error: { code: "42501" } }).client, "u", "app_opened"),
    ).resolves.toBeUndefined();
    await expect(
      trackEvent(fake({ error: { code: "23505" } }).client, "u", "app_opened"),
    ).resolves.toBeUndefined();
    const rejecting = {
      from: () => ({ insert: () => Promise.reject(new Error("x")) }),
    } as unknown as EventsClient;
    await expect(trackEvent(rejecting, "u", "app_opened")).resolves.toBeUndefined();
    const throwing = {
      from: () => {
        throw new Error("x");
      },
    } as unknown as EventsClient;
    await expect(trackEvent(throwing, "u", "app_opened")).resolves.toBeUndefined();
  });
});

describe("docs/metrics.md", () => {
  it("lists exactly EVENT_NAMES", () => {
    const md = readFileSync(join(__dirname, "..", "..", "..", "docs", "metrics.md"), "utf8");
    const section = md.split("## Events")[1] ?? "";
    const listed = [...section.matchAll(/^- `([a-z_]+)`/gm)].map((m) => m[1]);
    expect(listed.sort()).toEqual([...EVENT_NAMES].sort());
  });
});
