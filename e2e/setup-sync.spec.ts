import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Regression tests for lost setup edits (2026-09-26). The editor saved the
 * whole hunt with no check for staleness, so a copy restored by Back, or a
 * second tab, could show or save an old version over newer work.
 */

const PIN = "2468";
const photo = path.join(__dirname, "fixtures", "clue.jpg");

async function signInAndCreateHunt(page: Page): Promise<string> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await page.getByRole("button", { name: "New hunt" }).click();
  await expect(page).toHaveURL(/\/setup\/hunts\//);
  return page.url().split("/").pop()!;
}

async function addNameAndPhoto(page: Page) {
  // A parent types in the tab they're looking at; hidden tabs have their timers throttled.
  await page.bringToFront();
  await page.getByLabel("Child's name").fill("Sam");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).first().click()]);
  await chooser.setFiles(photo);
  await expect(page.getByAltText("Clue photo").first()).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();
}

async function serverHunt(page: Page, id: string) {
  return (await (await page.request.get(`/api/setup/hunts/${id}`)).json()).hunt;
}

test("the Back button shows the latest saved hunt, not a stale copy", async ({ page }) => {
  await signInAndCreateHunt(page);
  await addNameAndPhoto(page);

  await page.getByRole("link", { name: "All hunts" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  await page.goBack();

  await expect(page.getByLabel("Child's name")).toHaveValue("Sam");
  await expect(page.getByAltText("Clue photo").first()).toBeVisible();
});

test("a stale second editor can't overwrite newer work", async ({ page, context }) => {
  const id = await signInAndCreateHunt(page);
  const staleTab = await context.newPage();
  await staleTab.goto(page.url());
  await expect(staleTab.getByLabel("Child's name")).toBeVisible();
  // Keep this tab stale, like a device that was asleep: its background
  // checks for a newer version can't get through, so only its save can.
  const syncUrl = `**/api/setup/hunts/${id}`;
  await staleTab.route(syncUrl, (route) => (route.request().method() === "GET" ? route.abort() : route.fallback()));

  await addNameAndPhoto(page);

  // An edit in the stale tab before it has synced: refused, not saved over the top.
  await staleTab.bringToFront();
  await staleTab.getByLabel("Hunt title").fill("Sam's hunt");
  await expect(staleTab.getByRole("heading", { name: "This hunt was changed somewhere else" })).toBeVisible({ timeout: 15_000 });

  const stored = await serverHunt(page, id);
  expect(stored.childName).toBe("Sam");
  expect(stored.stations[0].clue.photoUrl).toBeTruthy();

  // Loading the latest brings the other tab's work into this one.
  await staleTab.unroute(syncUrl);
  await staleTab.getByRole("button", { name: "Load latest" }).click();
  await expect(staleTab.getByLabel("Child's name")).toHaveValue("Sam");
});

test("an idle second editor quietly picks up newer work", async ({ page, context }) => {
  await signInAndCreateHunt(page);
  const otherTab = await context.newPage();
  await otherTab.goto(page.url());

  await addNameAndPhoto(page);

  // Coming back to the idle tab refreshes it without a conflict.
  await otherTab.bringToFront();
  await otherTab.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(otherTab.getByLabel("Child's name")).toHaveValue("Sam", { timeout: 15_000 });
  await expect(otherTab.getByText("This hunt was changed somewhere else")).toHaveCount(0);
});
