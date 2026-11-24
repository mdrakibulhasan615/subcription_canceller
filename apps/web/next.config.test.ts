import { describe, expect, it } from "vitest";
import config from "./next.config";

describe("next config headers", () => {
  it("sets the security headers on every route", async () => {
    const [rule] = await config.headers!();
    expect(rule!.source).toBe("/(.*)");
    const h = Object.fromEntries(rule!.headers.map((x) => [x.key, x.value]));
    expect(h).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });
});
