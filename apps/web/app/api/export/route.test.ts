import { beforeEach, describe, expect, it, vi } from "vitest";

const queries: { table: string; col: string; v: string }[] = [];
let failTable: string | null = null;
let rowCount = 0;
let claims: { sub: string } | null = null;

const client = {
  from: (table: string) => ({
    select: () => ({
      eq: (col: string, v: string) => ({
        order: () => ({
          range: async (from: number, to: number) => {
            queries.push({ table, col, v });
            if (table === failTable) return { data: null, error: { message: "x" } };
            // Serve rowCount rows in pages, like PostgREST with max_rows 1000.
            const n = Math.max(0, Math.min(to + 1, rowCount) - from);
            return { data: Array.from({ length: n }, () => ({ name: "N" })), error: null };
          },
        }),
      }),
    }),
  }),
};
const track = vi.fn();
vi.mock("../../../lib/track", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("../../../lib/supabase/server", () => ({
  createClient: async () => client,
  getClaims: async () => claims,
}));

import { GET as getJson } from "./json/route";
import { GET as getCsv } from "./csv/route";
import { _resetRateLimit } from "../../../lib/rate-limit";

beforeEach(() => {
  _resetRateLimit();
  queries.length = 0;
  failTable = null;
  rowCount = 0;
  claims = { sub: "A" };
  track.mockReset();
});

describe("export routes", () => {
  it("1+2. json: attachment, all queries carry the user id", async () => {
    const res = await getJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(
      /^attachment; filename="stopdate-export-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.schema_version).toBe(1);
    expect(body.push_subscriptions).toEqual([]);
    expect(queries).toHaveLength(6);
    expect(
      queries.every((q) => q.v === "A" && q.col === (q.table === "profiles" ? "id" : "user_id")),
    ).toBe(true);
  });

  it("3. no session: 401 and no query, json and csv", async () => {
    claims = null;
    expect((await getJson()).status).toBe(401);
    expect((await getCsv()).status).toBe(401);
    expect(queries).toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
  });

  it("sends one export_downloaded event per success", async () => {
    await getJson();
    await getCsv();
    expect(track.mock.calls.map((c) => c.slice(1))).toEqual([
      ["A", "export_downloaded", { format: "json" }],
      ["A", "export_downloaded", { format: "csv" }],
    ]);
    failTable = "profiles";
    track.mockReset();
    expect((await getJson()).status).toBe(500);
    expect(track).not.toHaveBeenCalled();
  });

  it("csv: content type and header", async () => {
    const res = await getCsv();
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(await res.text()).toContain("name,category,price");
  });

  it("7. sixth export in the window gets 429", async () => {
    for (let i = 0; i < 5; i++) expect((await getJson()).status).toBe(200);
    const res = await getCsv();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("8b. a full first page triggers a second request", async () => {
    rowCount = 1000;
    const res = await getJson();
    expect(res.status).toBe(200);
    expect(queries.filter((q) => q.table === "subscriptions")).toHaveLength(2);
    expect((await res.json()).subscriptions).toHaveLength(1000);
  });

  it("8. query error and row cap give 500 with no file", async () => {
    failTable = "reminders";
    let res = await getJson();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
    failTable = null;
    rowCount = 10000;
    res = await getCsv();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(await res.json()).toEqual({ error: expect.stringContaining("too large") });
  });
});
