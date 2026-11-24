import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn((t: string) =>
  t === "guides" ? { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle }) }) }) } : { insert },
);
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from }) }));

import { POST } from "./route";
import { _resetRateLimit } from "../../../lib/rate-limit";

let n = 0;
const good = { kind: "cancel", slug: "netflix", message: "Step 2 is wrong" };
function req(body: unknown, ip = `9.9.9.${n++}`, raw = false) {
  return new Request("http://x/api/guide-report", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  _resetRateLimit();
  insert.mockReset().mockResolvedValue({ error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: { id: "g1" }, error: null });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

describe("POST /api/guide-report", () => {
  it("7. valid report inserts one row with the guide id", async () => {
    const res = await POST(req(good));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ guide_id: "g1", message: "Step 2 is wrong" });
  });

  it("8. honeypot returns 200 and skips insert", async () => {
    const res = await POST(req({ ...good, website: "x" }));
    expect(res.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it("9. 6th report from one IP gets 429 with Retry-After", async () => {
    for (let i = 0; i < 5; i++) expect((await POST(req(good, "7.7.7.7"))).status).toBe(200);
    const res = await POST(req(good, "7.7.7.7"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("10. bad message, kind or JSON returns 400", async () => {
    for (const b of [
      { ...good, message: "abc" },
      { ...good, message: "a".repeat(501) },
      { ...good, kind: "nope" },
    ]) {
      expect((await POST(req(b))).status).toBe(400);
    }
    expect((await POST(req("{bad", undefined, true))).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("unknown guide returns 404", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await POST(req(good))).status).toBe(404);
  });

  it("DB error returns 500 with no internals", async () => {
    insert.mockResolvedValue({ error: { code: "54000", message: "db secret" } });
    const res = await POST(req(good));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, error: "server" });
    expect(text).not.toContain("secret");
  });
});
