import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { guideSchema } from "@app/core";
import { GuideView } from "./guide-view";
import { ReportButton } from "./report-button";

const base = guideSchema.parse({
  kind: "cancel",
  service_slug: "x",
  title: "X",
  steps: [{ text: "First", link: "https://a.example/s", note: "Note one" }, { text: "Second" }],
  url: "https://a.example",
  source_url: "https://a.example/help",
  last_checked_at: "2026-01-01",
});
const render = (g: object, today = "2026-05-01") =>
  renderToStaticMarkup(createElement(GuideView, { guide: { ...base, ...g }, todayIso: today }));

describe("GuideView", () => {
  it("3. ordered steps, safe links, date, honest note, one h1", () => {
    const html = render({});
    expect(html.indexOf("First")).toBeLessThan(html.indexOf("Second"));
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("Last checked 1 January 2026");
    expect(html).toContain("Freezing or closing a card does not cancel a subscription");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.toLowerCase()).not.toContain("cancelled");
  });

  it("4. stale badge: 121 days yes, 120 no, null yes", () => {
    expect(render({}, "2026-05-02")).toContain("May be out of date");
    expect(render({}, "2026-05-01")).not.toContain("May be out of date");
    const html = render({ last_checked_at: null });
    expect(html).toContain("May be out of date");
    expect(html).toContain("Not checked yet");
  });

  it("5. tel and mailto only when set", () => {
    const none = render({});
    expect(none).not.toContain("tel:");
    expect(none).not.toContain("mailto:");
    const html = render({ contact_phone: "+1 800 555 0100", contact_email: "a@b.example" });
    expect(html).toContain('href="tel:+18005550100"');
    expect(html).toContain('href="mailto:a@b.example"');
  });

  it("report button has a visible label", () => {
    expect(
      renderToStaticMarkup(createElement(ReportButton, { kind: "cancel", slug: "x" })),
    ).toContain("Report a problem");
  });
});
