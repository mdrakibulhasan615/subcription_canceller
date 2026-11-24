import { describe, expect, test } from "vitest";
import { deriveStatus, type StatusInput } from "./status";

const today = "2026-11-24";
const base: StatusInput = { stopDate: null, merchantCancelledAt: null, stopConfirmedAt: null };
const t = "2026-11-01T00:00:00Z";

describe("deriveStatus", () => {
  test("cancelled wins", () => {
    const s = { ...base, merchantCancelledAt: t, stopConfirmedAt: t, stopDate: "2026-12-01" };
    expect(deriveStatus(s, today)).toBe("cancelled");
  });
  test("confirmed is stopped", () => {
    const s = { ...base, stopConfirmedAt: t, stopDate: "2026-11-01" };
    expect(deriveStatus(s, today)).toBe("stopped");
  });
  test("no stop date is active", () => {
    expect(deriveStatus(base, today)).toBe("active");
  });
  test("soon window", () => {
    expect(deriveStatus({ ...base, stopDate: "2026-12-01" }, today)).toBe("stopping_soon");
    expect(deriveStatus({ ...base, stopDate: "2026-11-24" }, today)).toBe("stopping_soon");
    expect(deriveStatus({ ...base, stopDate: "2026-12-02" }, today)).toBe("active");
    expect(deriveStatus({ ...base, stopDate: "2026-12-20" }, today)).toBe("active");
    expect(deriveStatus({ ...base, stopDate: "2026-12-02" }, today, 10)).toBe("stopping_soon");
  });
  test("passed and unconfirmed is stopping_soon", () => {
    expect(deriveStatus({ ...base, stopDate: "2026-11-20" }, today)).toBe("stopping_soon");
  });
});
