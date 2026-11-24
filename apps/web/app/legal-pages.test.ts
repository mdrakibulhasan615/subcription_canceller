import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { routeDecision } from "../lib/auth-routes";
import { LEGAL_UPDATED } from "../lib/legal";
import Error from "./error";
import GlobalError from "./global-error";
import Privacy from "./privacy/page";
import Terms from "./terms/page";

describe("legal pages", () => {
  for (const [name, Page] of [
    ["privacy", Privacy],
    ["terms", Terms],
  ] as const) {
    it(`${name}: h1, date, banner, contact, footer links`, () => {
      const html = renderToStaticMarkup(createElement(Page));
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html).toContain(`Last updated: ${LEGAL_UPDATED}`);
      expect(html).toContain("Template text. Not yet reviewed by a lawyer.");
      expect(html).toContain("contact@example.com");
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/terms"');
    });
  }

  it("stay public", () => {
    for (const p of ["/privacy", "/terms"]) {
      expect(routeDecision(p, "", false)).toEqual({ type: "next" });
      expect(routeDecision(p, "", true)).toEqual({ type: "next" });
    }
  });
});

describe("error pages", () => {
  const err = Object.assign(new globalThis.Error("secret detail"), { digest: "abc123" });
  for (const [name, C] of [
    ["error", Error],
    ["global-error", GlobalError],
  ] as const) {
    it(`${name}: friendly copy, no message or stack`, () => {
      const html = renderToStaticMarkup(createElement(C, { error: err, retry: () => {} }));
      expect(html).toContain("Something went wrong.");
      expect(html).toContain("Your data is safe.");
      expect(html).toContain("Reference: abc123");
      expect(html).not.toContain("secret detail");
      expect(html).toContain("Try again");
      expect(html).toContain('href="/"');
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    });
  }
});
