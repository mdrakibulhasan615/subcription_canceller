import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveInterest = vi.fn();
let claims: { sub?: string } | null = { sub: "u1" };
vi.mock("../../lib/supabase/server", () => ({
  getClaims: async () => claims,
  createClient: async () => ({}),
}));
vi.mock("../../lib/card-interest", async (orig) => ({
  ...(await orig<typeof import("../../lib/card-interest")>()),
  saveInterest: (...a: unknown[]) => saveInterest(...a),
}));

import { CardInterest } from "./card-interest";
import { answerCardInterest } from "./card-interest-actions";

const fd = (answer?: string) => {
  const f = new FormData();
  if (answer) f.set("answer", answer);
  return f;
};
beforeEach(() => {
  saveInterest.mockReset().mockResolvedValue(undefined);
  claims = { sub: "u1" };
});

describe("answerCardInterest", () => {
  it("saves a valid answer once", async () => {
    expect(await answerCardInterest(fd("yes"))).toEqual({ ok: true });
    expect(saveInterest).toHaveBeenCalledOnce();
    expect(saveInterest.mock.calls[0]?.slice(1)).toEqual(["u1", "yes"]);
  });

  it("rejects an invalid value without a write", async () => {
    const r = await answerCardInterest(fd("sure"));
    expect(r.ok).toBe(false);
    expect(saveInterest).not.toHaveBeenCalled();
  });

  it("asks to sign in", async () => {
    claims = null;
    expect(await answerCardInterest(fd("no"))).toEqual({
      ok: false,
      message: "Sign in to answer.",
    });
    expect(saveInterest).not.toHaveBeenCalled();
  });

  it("returns a message when the write fails", async () => {
    saveInterest.mockRejectedValue(new Error("x"));
    expect((await answerCardInterest(fd("maybe"))).ok).toBe(false);
  });
});

describe("CardInterest render", () => {
  it("shows legend, three answers, honest text and Not now", () => {
    const html = renderToStaticMarkup(h(CardInterest));
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain("Would you want the card to close automatically?");
    expect(html).toContain("Nothing is charged or created.");
    for (const v of ["yes", "maybe", "no"]) expect(html).toContain(`value="${v}"`);
    expect(html).toContain("Not sure");
    expect(html).toContain("Not now");
    expect(html).toContain('aria-live="polite"');
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
