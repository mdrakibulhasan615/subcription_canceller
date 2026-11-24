import { beforeEach, describe, expect, it, vi } from "vitest";

const BS = String.fromCharCode(92);
const EMAIL = "*%_" + BS + "@example.com";
const eq = vi.fn();
const ilike = vi.fn();
const deleteUser = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
}));
vi.mock("../../../../lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ delete: () => ({ eq, ilike }) }),
    auth: { admin: { deleteUser } },
  }),
}));
vi.mock("../../../../lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: async () => ({}) } }),
  getClaims: async () => ({
    sub: "u1",
    email: "*%_" + BS + "@Example.com",
    amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) - 30 }],
  }),
}));

import { deleteAccountAction } from "./actions";

beforeEach(() => {
  eq.mockReset().mockResolvedValue({ error: null });
  ilike.mockReset();
  deleteUser.mockReset().mockResolvedValue({ error: null });
});

describe("deleteAccountAction", () => {
  it("2. waitlist delete is an exact eq match, never a pattern", async () => {
    const fd = new FormData();
    fd.set("confirm", "DELETE");
    fd.set("email", EMAIL);
    await expect(deleteAccountAction({ status: "idle" }, fd)).rejects.toThrow("REDIRECT");
    expect(eq).toHaveBeenCalledWith("email", EMAIL);
    expect(ilike).not.toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("u1");
  });
});
