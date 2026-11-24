import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ init, captureRequestError: vi.fn() }));

async function load() {
  vi.resetModules();
  return import("./instrumentation");
}

describe("instrumentation", () => {
  beforeEach(() => init.mockReset());
  afterEach(() => vi.unstubAllEnvs());

  it("skips init without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    (await load()).register();
    expect(init).not.toHaveBeenCalled();
  });

  it("inits with sendDefaultPii false when the DSN is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://k@o1.ingest.sentry.io/1");
    const m = await load();
    m.register();
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ sendDefaultPii: false, tracesSampleRate: 0, enabled: true }),
    );
    expect(m.onRequestError).toBeTypeOf("function");
  });

  it("does not throw when init throws", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "bad");
    init.mockImplementationOnce(() => {
      throw new Error("bad dsn");
    });
    const m = await load();
    m.register();
    expect(init).toHaveBeenCalled();
  });
});
