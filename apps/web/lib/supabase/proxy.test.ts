import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _u: string,
    _k: string,
    o: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        // Like the real client: a refresh writes cookies while checking claims.
        o.cookies.setAll([{ name: "sb-token", value: "v1", options: { path: "/" } }], {
          "cache-control": "no-store",
        });
        return getClaims();
      },
    },
  }),
}));

import { updateSession } from "./proxy";

const req = () => new NextRequest("http://localhost/app");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://x.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
});
afterEach(() => {
  vi.unstubAllEnvs();
  getClaims.mockReset();
});

describe("updateSession", () => {
  it("10. no claims -> not authed; claims -> authed; cookies reach the response", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    expect((await updateSession(req())).isAuthed).toBe(false);

    getClaims.mockResolvedValue({ data: { claims: { sub: "u" } }, error: null });
    const { response, isAuthed } = await updateSession(req());
    expect(isAuthed).toBe(true);
    expect(response.cookies.get("sb-token")?.value).toBe("v1");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("fails closed on error, throw, or missing env", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "u" } }, error: new Error("x") });
    expect((await updateSession(req())).isAuthed).toBe(false);
    getClaims.mockRejectedValue(new Error("boom"));
    expect((await updateSession(req())).isAuthed).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await updateSession(req())).isAuthed).toBe(false);
  });
});
