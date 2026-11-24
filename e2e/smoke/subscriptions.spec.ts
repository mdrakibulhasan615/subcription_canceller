import { addDays, addSubscription, expect, fmt, test } from "../helpers/app";
import { admin } from "../helpers/supabase";

async function reminders(subId: string) {
  const { data, error } = await admin()
    .from("reminders")
    .select("type, channel, status, fire_at")
    .eq("subscription_id", subId);
  if (error) throw new Error(`e2e: reminders query failed: ${error.message}`);
  return data;
}

test("S2 add a subscription: list, detail, default stop date", async ({ app: page }) => {
  const name = "S2 Streaming";
  const { id, renewal, defaultStop } = await addSubscription(page, name);
  await expect(page.getByRole("heading", { level: 1, name: "Set your stop date" })).toBeVisible();

  await page.goto("/app/subscriptions");
  const link = page.getByRole("link", { name: new RegExp(name) }).first();
  await expect(link).toContainText("$15.99");
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/app/subscriptions/${id}$`));
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  const dates = page.locator("dl > div");
  await expect(dates.filter({ hasText: "Next renewal:" })).toContainText(fmt(renewal));
  // Default stop date = renewal - 3 days.
  await expect(dates.filter({ hasText: "Stop date:" })).toContainText(fmt(defaultStop));
});

test("S3 stop-flow, then dashboard totals and next stop date", async ({ app: page }) => {
  const name = "S3 Streaming";
  const { id, renewal } = await addSubscription(page, name);
  const stop = addDays(renewal, -5);

  await page.getByLabel("New stop date").fill(stop);
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Pick how you will stop payment" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: /Other virtual card/ }).check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Remind me to freeze it" }),
  ).toBeVisible();
  await expect(page.getByText("These reminders are set.")).toBeVisible();
  await page.getByRole("link", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "You are all set" })).toBeVisible();

  // Dashboard. The card-interest question card may show here. It does not block anything.
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Dashboard" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Totals" })).toContainText("$15.99");
  const next = page.getByRole("region", { name: "Next 5 dates" });
  await expect(next).toContainText(name);
  await expect(next.getByRole("listitem").filter({ hasText: "Stop date" })).toContainText(
    fmt(stop),
  );

  // Reminder rows for 7, 3 and 1 days before the new stop date (in-app channel).
  const rows = (await reminders(id)).filter(
    (r) => r.type === "stop_date" && r.channel === "in_app" && r.status === "pending",
  );
  expect(rows.map((r) => String(r.fire_at).slice(0, 10)).sort()).toEqual(
    [addDays(stop, -7), addDays(stop, -3), addDays(stop, -1)].sort(),
  );
});

test("S4 mark stopped: badge reads Stopped, pending reminders skipped", async ({ app: page }) => {
  const { id } = await addSubscription(page, "S4 Streaming");
  expect((await reminders(id)).filter((r) => r.status === "pending").length).toBeGreaterThan(0);

  await page.goto(`/app/subscriptions/${id}`);
  const confirm = page.getByRole("alertdialog", { name: "Confirm marking as stopped" });
  // The button needs hydration: retry the click until the dialog opens.
  await expect(async () => {
    await page.getByRole("button", { name: "I froze or closed my card" }).click();
    await expect(confirm).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await confirm.getByRole("button", { name: "Yes, mark as stopped" }).click();
  await expect(page.getByText("Marked as stopped. Reminders are off.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
  await expect(page.getByText(/Marked as stopped on/)).toBeVisible();

  const after = await reminders(id);
  expect(after.filter((r) => r.status === "pending")).toEqual([]);
  expect(after.filter((r) => r.status === "skipped").length).toBeGreaterThan(0);
});
