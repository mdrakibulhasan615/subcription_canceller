import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "./page";
import { WaitlistForm } from "./waitlist-form";

describe("landing markup", () => {
  const html = renderToStaticMarkup(createElement(Page));

  it("9. says payments stop and warns that freezing is not cancelling", () => {
    expect(html.toLowerCase()).toContain("payments stop");
    expect(html).toContain("Freezing a card does not cancel a subscription.");
    expect(html.toLowerCase()).not.toContain("cancelled");
  });

  it("has one h1", () => {
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
  });
});

describe("waitlist form markup", () => {
  const html = renderToStaticMarkup(createElement(WaitlistForm));

  it("10. label tied to input, honeypot hidden, live region present", () => {
    expect(html).toMatch(/<label[^>]*for="waitlist-email"/);
    expect(html).toMatch(/<input[^>]*id="waitlist-email"/);
    expect(html).toMatch(
      /aria-hidden="true"[^>]*><label[^>]*>[^<]*<\/label><input[^>]*tabindex="-1"[^>]*name="website"/,
    );
    expect(html).toContain('aria-live="polite"');
  });
});
