import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/web/**/*.test.ts",
      "supabase/functions/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
