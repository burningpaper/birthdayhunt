import { expect, test, type Page } from "@playwright/test";
import { solveLock } from "./solvers";

/**
 * Testing on an iPhone: the play screens are built for an iPad, so on a
 * phone the play area scrolls instead of clipping. iPads must be unchanged.
 */

const PIN = "2468";
const IPHONE_LANDSCAPE = { width: 844, height: 390 };

async function lockStation(page: Page): Promise<string> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Phone" } })).json();
  hunt.stations[0].puzzle = {
    type: "countingLock",
    digits: 3,
    questions: ["How many cushions are on the couch?", "How many windows in the kitchen?", "How many wheels on your bike?"].map((questionText) => ({ questionText, answer: 1 })),
  };
  hunt.stations[0].clue = { text: "I keep things cold and hum all night", showText: true };
  expect((await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: hunt })).ok()).toBe(true);
  const s = hunt.stations[0];
  return `/h/${hunt.id}/s/${s.id}?k=${s.key}&preview=1`;
}

const playArea = (page: Page) =>
  page.locator(".play-surface").evaluate((el) => ({ overflowY: getComputedStyle(el).overflowY, scrollTop: el.scrollTop, tall: el.scrollHeight > el.clientHeight }));

test("on an iPhone the play screens scroll, and a whole station can be played", async ({ page }) => {
  const url = await lockStation(page);
  await page.setViewportSize(IPHONE_LANDSCAPE);
  await page.goto(url);

  expect((await playArea(page)).overflowY).toBe("auto");
  await page.getByRole("button", { name: "Tap to start!" }).click();

  // The puzzle opens at the top, not wherever the intro was scrolled to.
  await expect.poll(async () => (await playArea(page)).scrollTop).toBe(0);
  expect((await playArea(page)).tall).toBe(true);

  // Every control is reachable by scrolling, including Open! below the fold.
  await solveLock(page, [1, 1, 1]);
  await expect(page.getByText("You did it!")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("I keep things cold and hum all night")).toBeVisible({ timeout: 10_000 });
});

test("on an iPad the play screens don't scroll", async ({ page }) => {
  const url = await lockStation(page);
  await page.goto(url); // the project's iPad landscape viewport
  expect((await playArea(page)).overflowY).toBe("hidden");
});
