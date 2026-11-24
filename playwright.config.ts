import { defineConfig } from "@playwright/test";

const port = 3000;
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  // Build first: `pnpm build`. Public pages need no Supabase env.
  webServer: {
    command: "pnpm --filter @app/web start",
    url: `http://localhost:${port}`,
    // CI: the workflow starts the app (with the Supabase env) and waits for it.
    reuseExistingServer: true,
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
  projects: [
    { name: "public", testMatch: "a11y/public.spec.ts" },
    {
      // Needs a local Supabase stack and the env from the e2e workflow (see .github/workflows/e2e.yml).
      name: "smoke",
      testMatch: "smoke/*.spec.ts",
      timeout: 90_000,
      // The profile default zone is UTC: dates in the specs are computed in UTC.
      use: { timezoneId: "UTC" },
    },
  ],
});
