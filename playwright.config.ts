import { defineConfig } from "@playwright/test";

const port = 3000;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  // Build first: `pnpm build`. Public pages need no Supabase env.
  webServer: {
    command: "pnpm --filter @app/web start",
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: { timeout: ci ? 10_000 : 5_000 },
  retries: ci ? 1 : 0,
  workers: ci ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  projects: [{ name: "public", testMatch: "a11y/public.spec.ts" }],
});
