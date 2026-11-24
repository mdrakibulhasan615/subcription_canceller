import { beforeEach, describe, expect, it, vi } from "vitest";

const getAnonClient = vi.fn();
vi.mock("./waitlist", () => ({ getAnonClient: () => getAnonClient() }));

import { loadGuide, loadGuides, submitGuideReport } from "./guides";

const row = {
  kind: "cancel",
  service_slug: "netflix",
  title: "Netflix DB",
  steps: [{ text: "a" }],
  url: null,
  source_url: "https://a.example",
  last_checked_at: "2026-01-01",
};

function dbWith(result: unknown) {
  return { from: () => ({ select: () => Promise.resolve(result) }) };
}

beforeEach(() => getAnonClient.mockReset());

describe("loadGuides", () => {
  it("2. falls back to JSON when env is missing", async () => {
    getAnonClient.mockReturnValue({
      from: () => {
        throw new Error("Supabase env missing");
      },
    });
    const g = await loadGuides();
    expect(g.some((x) => x.service_slug === "netflix")).toBe(true);
  });

  it("falls back on DB error and skips invalid rows", async () => {
    getAnonClient.mockReturnValue(dbWith({ data: null, error: { message: "x" } }));
    expect((await loadGuide("cancel", "netflix"))?.title).toBe("Netflix");
    getAnonClient.mockReturnValue(
      dbWith({ data: [{ ...row, url: "http://bad.example" }], error: null }),
    );
    expect((await loadGuide("cancel", "netflix"))?.title).toBe("Netflix");
  });

  it("DB row wins when valid", async () => {
    getAnonClient.mockReturnValue(dbWith({ data: [row], error: null }));
    expect((await loadGuide("cancel", "netflix"))?.title).toBe("Netflix DB");
    expect(await loadGuide("cancel", "nope")).toBeNull();
  });
});

describe("submitGuideReport", () => {
  function fake(found: boolean, insertError: unknown = null) {
    const insert = vi.fn().mockResolvedValue({ error: insertError });
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: found ? { id: "g1" } : null, error: null });
    const eq2 = { maybeSingle };
    const from = vi.fn((t: string) =>
      t === "guides" ? { select: () => ({ eq: () => ({ eq: () => eq2 }) }) } : { insert },
    );
    return { client: { from } as never, insert };
  }

  it("7. inserts one row with the guide id", async () => {
    const { client, insert } = fake(true);
    expect(
      await submitGuideReport(client, { kind: "cancel", slug: "netflix", message: "wrong" }),
    ).toBe("ok");
    expect(insert).toHaveBeenCalledWith({ guide_id: "g1", message: "wrong" });
  });

  it("returns not_found and throws on insert error", async () => {
    const a = fake(false);
    expect(await submitGuideReport(a.client, { kind: "cancel", slug: "x", message: "wrong" })).toBe(
      "not_found",
    );
    expect(a.insert).not.toHaveBeenCalled();
    const b = fake(true, { code: "54000" });
    await expect(
      submitGuideReport(b.client, { kind: "cancel", slug: "netflix", message: "wrong" }),
    ).rejects.toThrow();
  });
});
