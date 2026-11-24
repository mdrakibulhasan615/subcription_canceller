import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".next") return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("service role key", () => {
  const files = ["app", "lib", "components"].flatMap((d) => walk(join(root, d)));
  const src = (p: string) => readFileSync(p, "utf8");
  const self = (p: string) => /admin-scan\.test\.ts$/.test(p);

  it("16. only admin.ts reads the key, and it imports server-only", () => {
    const readers = files.filter((p) => !self(p) && src(p).includes("SERVICE_ROLE_KEY"));
    expect(readers.map((p) => p.replace(root, "").replaceAll("\\", "/"))).toEqual([
      "/lib/supabase/admin.ts",
    ]);
    expect(src(readers[0]!)).toContain('import "server-only"');
    expect(files.some((p) => !self(p) && src(p).includes("NEXT_PUBLIC_SUPABASE_SERVICE"))).toBe(
      false,
    );
  });

  it("16b. no client file imports admin", () => {
    const bad = files.filter(
      (p) => /^\s*["']use client["']/.test(src(p)) && /supabase\/admin/.test(src(p)),
    );
    expect(bad).toEqual([]);
  });
});
