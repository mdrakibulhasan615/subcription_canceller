import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = ["/", "/sign-in", "/privacy", "/terms", "/guides", "/guides/cancel/netflix"];
const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "1280", width: 1280, height: 800 },
];
const schemes = ["light", "dark"] as const;

for (const path of pages) {
  for (const vp of viewports) {
    for (const colorScheme of schemes) {
      test(`${path} ${vp.name} ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.emulateMedia({ colorScheme });
        expect((await page.goto(path))?.status()).toBe(200);

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const bad = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        for (const v of results.violations) {
          if (!bad.includes(v)) console.log(`axe ${v.impact} ${path}: ${v.id} (${v.nodes.length})`);
        }
        expect(
          bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
        ).toEqual([]);

        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      });
    }
  }

  test(`${path} no horizontal scroll at 320`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
