import { expect, test } from "../helpers/app";
import { magicLinkFor } from "../helpers/mail";
import { admin, createUser, signIn } from "../helpers/supabase";

test("S1 magic link sign-in, onboarding, dashboard", async ({ page, user }) => {
  await page.goto("/sign-in");
  // The form is a React handler: wait for the scripts, or a fast click submits a plain GET.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("Check your email.")).toBeVisible();

  // Same browser context: the PKCE code verifier cookie is set here.
  await page.goto(await magicLinkFor(user.email));
  await expect(page).toHaveURL(/\/app\/onboarding/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Set your timezone and currency" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose your reminders" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Add your first subscription" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Skip, go to dashboard" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});

test("S5 signed-out /app redirects to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
});

test("S5 user A gets 404 for user B's subscription", async ({ app, browser }) => {
  const other = await createUser();
  const { data, error } = await admin()
    .from("subscriptions")
    .insert({
      user_id: other.id,
      name: "Private B",
      price_minor: 1599,
      currency: "USD",
      billing_cycle: "monthly",
      next_renewal_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`e2e: insert failed: ${error?.message}`);
  const path = `/app/subscriptions/${data.id}`;

  // Control: the owner can open it (so a 404 below is not a broken route).
  const ctxB = await browser.newContext({ timezoneId: "UTC" });
  try {
    await signIn(ctxB, other);
    const pageB = await ctxB.newPage();
    const own = await pageB.goto(new URL(path, "http://localhost:3000").toString());
    expect(own?.status()).toBe(200);
    await expect(pageB.getByRole("heading", { level: 1, name: "Private B" })).toBeVisible();
  } finally {
    await ctxB.close();
  }

  const res = await app.goto(path);
  expect(res?.status()).toBe(404);
  await expect(app.getByText("This page could not be found.")).toBeVisible();
  await expect(app.getByText("Private B")).toHaveCount(0);
});
