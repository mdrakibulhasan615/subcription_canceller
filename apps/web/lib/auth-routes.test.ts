import { describe, expect, it } from "vitest";
import { routeDecision, safeNext } from "./auth-routes";

describe("safeNext", () => {
  it("1. keeps a same-origin /app path", () => {
    expect(safeNext("/app/settings?tab=1")).toBe("/app/settings?tab=1");
    expect(safeNext("/app")).toBe("/app");
  });

  it("2. rejects everything else", () => {
    const bad = [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "javascript:alert(1)",
      "/app\n",
      "/app/x y",
      "/%2f%2fevil.com",
      "/app%0a",
      "/app/%",
      "/other",
      "/application",
      "/app" + "a".repeat(200),
      "",
      null,
      undefined,
      42,
    ];
    for (const raw of bad) expect(safeNext(raw), String(raw)).toBe("/app");
  });
});

describe("routeDecision", () => {
  it("3. sends a guest on /app to sign-in with next", () => {
    expect(routeDecision("/app/x", "?a=1", false)).toEqual({
      type: "redirect",
      to: "/sign-in?next=%2Fapp%2Fx%3Fa%3D1",
    });
  });

  it("4. leaves public routes alone for a guest", () => {
    for (const p of [
      "/",
      "/privacy",
      "/terms",
      "/sign-in",
      "/auth/callback",
      "/api/waitlist",
      "/application",
    ]) {
      expect(routeDecision(p, "", false), p).toEqual({ type: "next" });
    }
  });

  it("5. signed-in user skips sign-in, can use /app", () => {
    expect(routeDecision("/sign-in", "", true)).toEqual({ type: "redirect", to: "/app" });
    expect(routeDecision("/app", "", true)).toEqual({ type: "next" });
  });
});
