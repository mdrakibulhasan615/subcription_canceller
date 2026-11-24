import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GUIDE_FILES } from "./guides-data";
import { guideSchema } from "./guides";

const files = readdirSync(new URL("./guides-data/", import.meta.url)).filter((f) =>
  f.endsWith(".json"),
);

describe("guides-data", () => {
  it("14. index lists every JSON file", () => {
    expect(Object.keys(GUIDE_FILES).sort()).toEqual([...files].sort());
  });

  it.each(files)("%s is a valid guide", (f) => {
    const g = guideSchema.parse(GUIDE_FILES[f]);
    expect(f).toBe(`${g.kind}--${g.service_slug}.json`);
    expect(g.source_url).not.toBeNull();
    expect(JSON.stringify(g.steps).toLowerCase()).not.toContain("cancelled");
  });
});
