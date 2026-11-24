import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.fn();
let claims: { sub?: string } | null = { sub: "u1" };
const ID = "11111111-1111-4111-8111-111111111111";
const saveSubscription = vi.fn();
const subActions = {
  markStopped: vi.fn(),
  markMerchantCancelled: vi.fn(),
  extendStopDate: vi.fn(),
};
const commitImport = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("REDIRECT");
  },
  notFound: () => {
    throw new Error("NOTFOUND");
  },
}));
vi.mock("../../lib/track", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("../../lib/supabase/server", () => ({
  getClaims: async () => claims,
  createClient: async () => ({ tag: "client" }),
}));
vi.mock("../../lib/subscriptions", async (orig) => ({
  ...(await orig<typeof import("../../lib/subscriptions")>()),
  saveSubscription: (...a: unknown[]) => saveSubscription(...a),
  createSubDb: () => ({}),
}));
vi.mock("../../lib/sub-actions", () => ({
  markStopped: (...a: unknown[]) => subActions.markStopped(...a),
  unmarkStopped: vi.fn(async () => ({ ok: true })),
  markMerchantCancelled: (...a: unknown[]) => subActions.markMerchantCancelled(...a),
  unmarkMerchantCancelled: vi.fn(async () => ({ ok: true })),
  extendStopDate: (...a: unknown[]) => subActions.extendStopDate(...a),
}));
vi.mock("../../lib/stop-flow", () => ({
  extendError: () => null,
  setStopMethod: vi.fn(),
}));
vi.mock("../../lib/csv-import", async (orig) => ({
  ...(await orig<typeof import("../../lib/csv-import")>()),
  commitImport: (...a: unknown[]) => commitImport(...a),
  createImportDb: () => ({}),
}));

import { saveSub } from "./subscriptions/actions";
import {
  extendStopAction,
  markCancelledAction,
  markStoppedAction,
  unmarkStoppedAction,
} from "./subscriptions/[id]/actions";
import { stopDateStepAction } from "./subscriptions/[id]/stop-flow/actions";
import { importAction } from "./import/actions";

const fd = (o: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const events = () => track.mock.calls.map((c) => c.slice(1));
const prev = { ok: false } as never;

beforeEach(() => {
  track.mockReset();
  claims = { sub: "u1" };
  saveSubscription.mockReset().mockResolvedValue({ ok: true, id: ID });
  subActions.markStopped.mockReset().mockResolvedValue({ ok: true });
  subActions.markMerchantCancelled.mockReset().mockResolvedValue({ ok: true });
  subActions.extendStopDate.mockReset().mockResolvedValue({ ok: true });
  commitImport
    .mockReset()
    .mockResolvedValue({ ok: true, imported: 4, skipped: 1, remindersOk: true });
});

describe("subscription_added", () => {
  it("one event on create, with only flags and enums", async () => {
    await expect(
      saveSub(
        null,
        prev,
        fd({ is_trial: "on", payment_method_type: "wise", name: "Secret", price: "9" }),
      ),
    ).rejects.toThrow("REDIRECT");
    expect(events()).toEqual([
      [
        "u1",
        "subscription_added",
        { has_stop_date: true, is_trial: true, payment_method_type: "wise", source: "form" },
      ],
    ]);
  });

  it("an unknown payment type becomes none", async () => {
    await expect(saveSub(null, prev, fd({ payment_method_type: "x@y.z" }))).rejects.toThrow();
    expect((events()[0]?.[2] as { payment_method_type: string }).payment_method_type).toBe("none");
  });

  it("none on edit, failure, or no session", async () => {
    await expect(saveSub(ID, prev, fd())).rejects.toThrow("REDIRECT");
    saveSubscription.mockResolvedValue({ ok: false, error: "server" });
    await saveSub(null, prev, fd());
    claims = null;
    await saveSub(null, prev, fd());
    expect(track).not.toHaveBeenCalled();
  });
});

describe("[id] actions", () => {
  it("one event per success", async () => {
    await markStoppedAction(ID);
    await markCancelledAction(ID);
    await extendStopAction(ID, fd({ stop_date: "2026-12-01" }));
    expect(events()).toEqual([
      ["u1", "subscription_stop_confirmed"],
      ["u1", "merchant_cancelled_marked"],
      ["u1", "stop_date_extended"],
    ]);
  });

  it("no event for unmark or on failure", async () => {
    await unmarkStoppedAction(ID);
    subActions.markStopped.mockResolvedValue({ ok: false, error: "server" });
    subActions.extendStopDate.mockResolvedValue({ ok: false, fieldError: "bad" });
    await markStoppedAction(ID);
    await extendStopAction(ID, fd({ stop_date: "x" }));
    expect(track).not.toHaveBeenCalled();
  });
});

describe("stop-flow", () => {
  it("sends stop_date_extended only on success", async () => {
    await expect(stopDateStepAction(ID, fd({ stop_date: "2026-12-01" }))).rejects.toThrow(
      "REDIRECT",
    );
    expect(events()).toEqual([["u1", "stop_date_extended"]]);
    track.mockReset();
    subActions.extendStopDate.mockResolvedValue({ ok: false, error: "server" });
    await expect(stopDateStepAction(ID, fd({ stop_date: "2026-12-01" }))).rejects.toThrow();
    expect(track).not.toHaveBeenCalled();
  });
});

describe("csv import", () => {
  const csv = (intent: string) => fd({ csv: "a", intent });
  it("one csv_imported event, no per-row events", async () => {
    await importAction({ status: "idle" }, csv("import"));
    expect(events()).toEqual([["u1", "csv_imported", { count: 4 }]]);
  });

  it("none on failure", async () => {
    commitImport.mockResolvedValue({ ok: false, message: "bad" });
    await importAction({ status: "idle" }, csv("import"));
    expect(track).not.toHaveBeenCalled();
  });
});
