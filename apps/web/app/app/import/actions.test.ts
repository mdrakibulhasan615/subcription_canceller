import { describe, expect, it, vi } from "vitest";

const createClient = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../lib/supabase/server", () => ({
  getClaims: async () => null,
  createClient: (...a: unknown[]) => createClient(...a),
}));

import { importAction } from "./actions";

describe("importAction without claims", () => {
  it("returns the auth message and never opens the database", async () => {
    const fd = new FormData();
    fd.set("csv", "name,price,billing_cycle,next_renewal_date\nA,1,monthly,2026-12-20");
    fd.set("intent", "import");
    expect(await importAction({ status: "idle" }, fd)).toEqual({
      status: "error",
      message: "Your session ended. Sign in again.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
