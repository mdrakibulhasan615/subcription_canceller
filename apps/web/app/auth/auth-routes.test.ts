import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
vi.mock("../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession, signOut } }),
}));

import * as callback from "./callback/route";
import * as signout from "./signout/route";

const get = (qs: string) => callback.GET(new Request(`http://localhost:3000/auth/callback${qs}`));

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
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
