import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from }) }));

const track = vi.fn();
vi.mock("../../../lib/track", () => ({ track: (...a: unknown[]) => track(...a) }));

import { POST } from "./route";
import { _resetRateLimit } from "../../../lib/rate-limit";

let n = 0;
function req(body: unknown, ip = `9.9.9.${n++}`, raw = false) {
  return new Request("http://x/api/waitlist", {
    method: "POST",
    headers: { "x-forwarded-for": ip, "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  _resetRateLimit();
  insert.mockReset().mockResolvedValue({ error: null });
  from.mockClear();
  track.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

describe("POST /api/waitlist", () => {
  it("1. inserts a lowercased email with a plain insert", async () => {
    const res = await POST(req({ email: "A@B.com", source: "landing" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("waitlist");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({ email: "a@b.com", source: "landing" });
    expect(track).toHaveBeenCalledOnce();
    expect(track.mock.calls[0]?.slice(1)).toEqual([null, "waitlist_joined"]);
  });

  it("2. duplicate returns the same 200", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "dup secret" } });
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(track).not.toHaveBeenCalled();
  });

  it("3. other error returns 500 with no error text", async () => {
    insert.mockResolvedValue({ error: { code: "XX000", message: "db secret" } });
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, error: "server" });
    expect(text).not.toContain("secret");
    expect(track).not.toHaveBeenCalled();
  });

  it("4. bad emails return 400 and skip insert", async () => {
    for (const email of ["nope", "", `${"a".repeat(250)}@b.com`]) {
      expect((await POST(req({ email }))).status).toBe(400);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("5. honeypot returns 200 and skips insert", async () => {
    const res = await POST(req({ email: "a@b.com", website: "x" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(insert).not.toHaveBeenCalled();
  });

  it("6. 6th request from one IP gets 429 with Retry-After", async () => {
    for (let i = 0; i < 5; i++)
      expect((await POST(req({ email: "a@b.com" }, "7.7.7.7"))).status).toBe(200);
    const res = await POST(req({ email: "a@b.com" }, "7.7.7.7"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(await res.json()).toEqual({ ok: false, error: "rate_limited" });
    expect((await POST(req({ email: "a@b.com" }, "8.8.8.8"))).status).toBe(200);
  });

  it("7. body that is not JSON returns 400", async () => {
    expect((await POST(req("{not json", undefined, true))).status).toBe(400);
  });

  it("8. missing env returns 500", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await POST(req({ email: "a@b.com" }));
    expect(res.status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
  });
});
