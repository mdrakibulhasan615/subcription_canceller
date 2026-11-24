import { beforeEach, describe, expect, it } from "vitest";
import { authTimeFromAmr, deleteAccount, type DeleteDeps } from "./account";

const NOW = 1_800_000_000_000;
let calls: string[];
let deps: DeleteDeps;
let user: { id: string; email: string | null; authTime?: number } | null;
let limit: { ok: boolean; retryAfterSec: number };
let wlErr: unknown;
let delErr: { message?: string; code?: string } | null;

const good = { confirm: "DELETE", email: " A@Example.com " };

beforeEach(() => {
  calls = [];
  user = { id: "u1", email: "a@example.com", authTime: NOW / 1000 - 60 };
  limit = { ok: true, retryAfterSec: 0 };
  wlErr = null;
  delErr = null;
  deps = {
    getUser: () => user,
    rateLimit: () => (calls.push("rateLimit"), limit),
    admin: {
      deleteWaitlistByEmail: async () => (calls.push("waitlist"), { error: wlErr }),
      deleteUser: async () => (calls.push("deleteUser"), { error: delErr }),
    },
    signOut: async () => void calls.push("signOut"),
    now: () => NOW,
  };
});

const code = (r: Awaited<ReturnType<typeof deleteAccount>>) =>
  r.status === "error" ? r.code : "ok";

describe("deleteAccount", () => {
  it("10. wrong confirm or email: error, admin not called", async () => {
    for (const f of [
      { confirm: "delete", email: "a@example.com" },
      { confirm: "", email: "a@example.com" },
      { confirm: "DELETE", email: "b@example.com" },
      { confirm: "DELETE", email: "" },
    ]) {
      calls = [];
      expect(code(await deleteAccount(deps, f))).toBe("confirm");
      expect(calls).toEqual(["rateLimit"]);
    }
  });

  it("11. valid: calls in order", async () => {
    expect(await deleteAccount(deps, good)).toEqual({ status: "ok" });
    expect(calls).toEqual(["rateLimit", "waitlist", "deleteUser", "signOut"]);
  });

  it("12. rate limit: no admin call", async () => {
    limit = { ok: false, retryAfterSec: 120 };
    const r = await deleteAccount(deps, good);
    expect(code(r)).toBe("rate");
    expect(r.status === "error" && r.message).toContain("2 minutes");
    expect(calls).toEqual(["rateLimit"]);
  });

  it("13. waitlist failure: user kept, not signed out", async () => {
    wlErr = new Error("x");
    expect(code(await deleteAccount(deps, good))).toBe("server");
    expect(calls).toEqual(["rateLimit", "waitlist"]);
  });

  it("14. user not found counts as success", async () => {
    delErr = { message: "User not found", code: "user_not_found" };
    expect(await deleteAccount(deps, good)).toEqual({ status: "ok" });
    expect(calls).toContain("signOut");
  });

  it("15. other delete error: server, no signOut", async () => {
    delErr = { message: "boom" };
    expect(code(await deleteAccount(deps, good))).toBe("server");
    expect(calls).not.toContain("signOut");
  });

  it("15b. thrown admin error: server", async () => {
    deps.admin.deleteUser = async () => {
      throw new Error("no key");
    };
    expect(code(await deleteAccount(deps, good))).toBe("server");
  });

  it("15c. signOut failure is ignored", async () => {
    deps.signOut = async () => {
      throw new Error("x");
    };
    expect(await deleteAccount(deps, good)).toEqual({ status: "ok" });
  });

  it("18. old session and null email", async () => {
    user = { id: "u1", email: "a@example.com", authTime: NOW / 1000 - 16 * 60 };
    expect(code(await deleteAccount(deps, good))).toBe("recent");
    user = { id: "u1", email: "a@example.com" };
    expect(code(await deleteAccount(deps, good))).toBe("recent");
    user = { id: "u1", email: null, authTime: NOW / 1000 };
    expect(code(await deleteAccount(deps, good))).toBe("no_email");
    expect(calls).not.toContain("waitlist");
  });

  it("18b. authTime is the newest amr timestamp", () => {
    expect(
      authTimeFromAmr([
        { method: "otp", timestamp: 5 },
        { method: "x", timestamp: 9 },
      ]),
    ).toBe(9);
    expect(authTimeFromAmr(["otp"])).toBeUndefined();
    expect(authTimeFromAmr(undefined)).toBeUndefined();
    expect(authTimeFromAmr([])).toBeUndefined();
  });

  it("3. no user: auth error, nothing called", async () => {
    user = null;
    expect(code(await deleteAccount(deps, good))).toBe("auth");
    expect(calls).toEqual([]);
  });
});
