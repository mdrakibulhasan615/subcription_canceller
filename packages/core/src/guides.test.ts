import { describe, expect, it } from "vitest";
import {
  guideReportSchema,
  guideSchema,
  guideStepsSchema,
  isGuideStale,
  matchGuideSlug,
} from "./guides";

describe("guideStepsSchema", () => {
  it("12. rejects non-array and http links", () => {
    expect(guideStepsSchema.safeParse("x").success).toBe(false);
    expect(guideStepsSchema.safeParse([{ text: "a", link: "http://a.com" }]).success).toBe(false);
    expect(guideStepsSchema.safeParse([{ text: "a", link: "javascript:alert(1)" }]).success).toBe(
      false,
    );
    expect(guideStepsSchema.safeParse([{ text: "a", link: "https://a.com" }]).success).toBe(true);
  });
});

describe("guideSchema", () => {
  const base = { kind: "cancel", service_slug: "x", title: "X", steps: [{ text: "a" }] };
  it("accepts a minimal guide and defaults nulls", () => {
    const r = guideSchema.parse(base);
    expect(r.url).toBeNull();
    expect(r.last_checked_at).toBeNull();
  });
  it("rejects bad slug, empty steps, http url, bad date", () => {
    expect(guideSchema.safeParse({ ...base, service_slug: "A b" }).success).toBe(false);
    expect(guideSchema.safeParse({ ...base, steps: [] }).success).toBe(false);
    expect(guideSchema.safeParse({ ...base, url: "http://a.com" }).success).toBe(false);
    expect(guideSchema.safeParse({ ...base, last_checked_at: "2026-13-45" }).success).toBe(false);
  });
});

describe("isGuideStale", () => {
  it("4. 121 days stale, 120 not, null stale", () => {
    expect(isGuideStale("2026-01-01", "2026-05-02")).toBe(true); // 121
    expect(isGuideStale("2026-01-01", "2026-05-01")).toBe(false); // 120
    expect(isGuideStale(null, "2026-05-01")).toBe(true);
  });
});

describe("matchGuideSlug", () => {
  it("13. matches aliases", () => {
    expect(matchGuideSlug("Netflix Premium")).toEqual({ kind: "cancel", slug: "netflix" });
    expect(matchGuideSlug("Disney Plus")?.slug).toBe("disney-plus");
    expect(matchGuideSlug("DISNEY+")?.slug).toBe("disney-plus");
    expect(matchGuideSlug("YouTube Premium family")?.slug).toBe("youtube-premium");
    expect(matchGuideSlug("Amazon Prime Video")?.slug).toBe("amazon-prime");
    expect(matchGuideSlug("Apple App Store")).toEqual({ kind: "store", slug: "apple-app-store" });
    expect(matchGuideSlug("Wise")).toEqual({ kind: "provider", slug: "wise" });
    expect(matchGuideSlug("Gym")).toBeNull();
    expect(matchGuideSlug("Primer")).toBeNull();
  });
});

describe("guideReportSchema", () => {
  it("10. message length 5..500", () => {
    const ok = { kind: "cancel", slug: "netflix", message: "link is broken" };
    expect(guideReportSchema.safeParse(ok).success).toBe(true);
    expect(guideReportSchema.safeParse({ ...ok, message: "  abc " }).success).toBe(false);
    expect(guideReportSchema.safeParse({ ...ok, message: "a".repeat(501) }).success).toBe(false);
    expect(guideReportSchema.safeParse({ ...ok, kind: "x" }).success).toBe(false);
  });
});
