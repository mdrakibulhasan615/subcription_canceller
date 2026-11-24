import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimit, clientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => _resetRateLimit());

  it("blocks the 6th request, allows other IPs, allows after the window", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("a", 1000).ok).toBe(true);
    const r = rateLimit("a", 1000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("b", 1000).ok).toBe(true);
    expect(rateLimit("a", 1000 + 10 * 60 * 1000).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("reads headers in order", () => {
    const h = (o: Record<string, string>) => new Request("http://x", { headers: o });
    expect(clientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2", "x-real-ip": "3.3.3.3" }))).toBe(
      "1.1.1.1",
    );
    expect(clientIp(h({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
