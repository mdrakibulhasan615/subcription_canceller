import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("real Sentry init", () => {
  it("no DSN: register does nothing and fetch is never called", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const f = vi.spyOn(globalThis, "fetch");
    const m = await import("../instrumentation");
    expect(() => m.register()).not.toThrow();
    const S = await import("@sentry/nextjs");
    S.captureException(new Error("x"));
    await new Promise((r) => setTimeout(r, 50));
    expect(f).not.toHaveBeenCalled();
  });
  it("malformed DSN: register does not throw", async () => {
    for (const d of ["not-a-dsn", "https://", "http://@@/x", "   "]) {
      vi.resetModules();
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", d);
      const m = await import("../instrumentation");
      expect(() => m.register(), d).not.toThrow();
    }
  });
});
