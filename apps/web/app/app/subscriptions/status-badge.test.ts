import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

const html = (s: Parameters<typeof StatusBadge>[0]["status"]) =>
  renderToStaticMarkup(createElement(StatusBadge, { status: s }));

describe("StatusBadge", () => {
  it.each([
    ["active", "Active"],
    ["stopping_soon", "Stopping soon"],
    ["stopped", "Stopped"],
    ["cancelled", "Cancelled with merchant"],
    ["failed", "Failed"],
  ] as const)("%s shows icon and text", (s, label) => {
    const h = html(s);
    expect(h).toContain("<svg");
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain(`</svg>${label}</span>`);
  });
});
