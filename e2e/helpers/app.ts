import { expect, test as base, type Page } from "@playwright/test";
import { createUser, signIn, type TestUser } from "./supabase";

export const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Today in UTC plus n days. The smoke project pins the browser zone to UTC, the profile default. */
export const inDays = (n: number) => addDays(new Date().toISOString().slice(0, 10), n);
/** Same format as the app (formatDate in apps/web/lib/sub-view.ts). */
export const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** `user`: a fresh account. `app`: a page already signed in as that user. */
export const test = base.extend<{ user: TestUser; app: Page }>({
  // eslint-disable-next-line no-empty-pattern
  user: async ({}, provide) => provide(await createUser()),
  app: async ({ context, page, user }, provide) => {
    await signIn(context, user);
    await provide(page);
  },
});
export { expect };

/** Adds 15.99 USD monthly, renewal in 30 days. The app then opens the stop-date flow. */
export async function addSubscription(
  page: Page,
  name: string,
): Promise<{ id: string; renewal: string; defaultStop: string }> {
  const renewal = inDays(30);
  const defaultStop = addDays(renewal, -3);
  await page.goto("/app/subscriptions/new");
  await expect(page.getByRole("heading", { level: 1, name: "Add subscription" })).toBeVisible();
  const stop = page.getByLabel("Stop date", { exact: true });
  // The suggested stop date is set by React on change: retry until the page is hydrated.
  await expect(async () => {
    const date = page.getByLabel("Next renewal date", { exact: true });
    await date.fill("");
    await date.fill(renewal);
    await expect(stop).toHaveValue(defaultStop, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Price", { exact: true }).fill("15.99");
  await page.getByLabel("Currency", { exact: true }).selectOption("USD");
  await page.getByLabel("Billing cycle", { exact: true }).selectOption("monthly");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/subscriptions\/[0-9a-f-]{36}\/stop-flow/);
  const id = /subscriptions\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!id) throw new Error(`e2e: no subscription id in ${page.url()}`);
  return { id, renewal, defaultStop };
}
