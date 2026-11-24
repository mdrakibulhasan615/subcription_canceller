import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const isNull = vi.fn();
const update = vi.fn();
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
  update: (v: unknown) => {
    update(v);
    return { eq: () => ({ is: isNull }) };
  },
}));
const track = vi.fn();
vi.mock("../../lib/track", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, signOut }, from }),
}));

import { postSignInPath, safeNext } from "../../lib/auth-routes";
import * as callback from "./callback/route";
import * as signout from "./signout/route";

const get = (qs: string) => callback.GET(new Request(`http://localhost:3000/auth/callback${qs}`));

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: { onboarded_at: null }, error: null });
  isNull.mockReset().mockResolvedValue({ error: null });
  update.mockReset();
  track.mockReset();
});

describe("postSignInPath", () => {
  it("T-019 1-4. onboarding only for a bare /app and a null flag", () => {
    expect(postSignInPath("/app", null)).toBe("/app/onboarding");
    expect(postSignInPath("/app", undefined)).toBe("/app/onboarding");
    expect(postSignInPath("/app", "2026-01-01T00:00:00Z")).toBe("/app");
    expect(postSignInPath("/app/subscriptions/new", null)).toBe("/app/subscriptions/new");
    for (const bad of ["//evil.com", "/app\\x", "https://evil.com"]) {
      expect(postSignInPath(safeNext(bad), null)).toBe("/app/onboarding");
    }
  });
});

describe("callback onboarding", () => {
  const withUser = () =>
    exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  const loc = async (qs: string) => (await get(qs)).headers.get("location");

  it("1. new user goes to onboarding and the flag is set", async () => {
    withUser();
    expect(await loc("?code=abc&next=/app")).toBe("http://localhost:3000/app/onboarding");
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0]?.[0]).toHaveProperty("onboarded_at");
    expect(track).toHaveBeenCalledOnce();
    expect(track.mock.calls[0]?.slice(1)).toEqual(["u1", "signed_in_first"]);
  });

  it("2. onboarded user goes to /app", async () => {
    withUser();
    maybeSingle.mockResolvedValue({ data: { onboarded_at: "2026-01-01T00:00:00Z" }, error: null });
    expect(await loc("?code=abc&next=/app")).toBe("http://localhost:3000/app");
    expect(update).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("3. a deep link skips onboarding and leaves the flag", async () => {
    withUser();
    expect(await loc("?code=abc&next=/app/subscriptions/new")).toBe(
      "http://localhost:3000/app/subscriptions/new",
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("5. select or update failure goes to /app", async () => {
    withUser();
    maybeSingle.mockResolvedValue({ data: null, error: new Error("x") });
    expect(await loc("?code=abc")).toBe("http://localhost:3000/app");
    maybeSingle.mockRejectedValue(new Error("boom"));
    expect(await loc("?code=abc")).toBe("http://localhost:3000/app");
    maybeSingle.mockResolvedValue({ data: { onboarded_at: null }, error: null });
    isNull.mockResolvedValue({ error: new Error("x") });
    expect(await loc("?code=abc")).toBe("http://localhost:3000/app");
    expect(track).not.toHaveBeenCalled();
  });
});

describe("callback GET", () => {
  it("6. exchanges the code and redirects to next", async () => {
    const res = await get("?code=abc&next=/app/x");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/app/x");
  });

  it("7. blocks an open redirect", async () => {
    const res = await get("?code=abc&next=//evil.com");
    expect(res.headers.get("location")).toBe("http://localhost:3000/app");
  });

  it("8. exchange error, no code, or provider error -> sign-in?error=callback", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad") });
    for (const qs of ["?code=abc", "?next=/app", "?error=access_denied&error_description=secret"]) {
      const res = await get(qs);
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("http://localhost:3000/sign-in?error=callback");
    }
    exchangeCodeForSession.mockRejectedValue(new Error("boom"));
    expect((await get("?code=abc")).headers.get("location")).toContain("error=callback");
  });
});

describe("signout", () => {
  it("9. POST signs out and goes home; GET is not exported (405)", async () => {
    const res = await signout.POST(
      new Request("http://localhost:3000/auth/signout", { method: "POST" }),
    );
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    expect("GET" in signout).toBe(false);
  });
});
