import { expect, test } from "@playwright/test";
import { solveMemory } from "./solvers";

/** The parent's gift notes and set-up checklist, which the child must never see. */

test("a parent notes a gift per station, ticks them off while setting up, and the child never sees them", async ({ page }) => {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Gifts" } })).json();
  await page.goto(`/setup/hunts/${hunt.id}`);

  // Station 1: where the code goes, and the gift that goes with it.
  await page.getByLabel("Where you'll hide this QR code").first().fill("Under the stairs");
  await page.getByLabel("Gift left with this code (optional)").first().fill("Blue box of bricks");
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });

  const checklist = page.getByTestId("setup-checklist");
  const first = checklist.locator('[data-station="1"]');
  await expect(first).toContainText("Under the stairs");
  await expect(first).toContainText("Blue box of bricks");
  await expect(checklist.locator('[data-station="2"]')).toContainText("No gift noted");
  await expect(checklist.getByText("0 of 7 placed")).toBeVisible();

  // Tick it off; the tick survives a reload (it's kept on this device).
  await checklist.getByLabel("Station 1 placed").check({ force: true });
  await expect(checklist.getByText("1 of 7 placed")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("setup-checklist").getByText("1 of 7 placed")).toBeVisible();

  // Not on the printed codes, which get hidden around the house.
  await page.goto(`/setup/hunts/${hunt.id}/print`);
  await expect(page.getByText("Under the stairs")).toBeVisible();
  await expect(page.getByText("Blue box of bricks")).toHaveCount(0);

  // And not on the child's screen.
  const saved = (await (await page.request.get(`/api/setup/hunts/${hunt.id}`)).json()).hunt;
  const s = saved.stations[0];
  const play = await page.request.get(`/api/play/${hunt.id}/${s.id}?k=${s.key}&preview=1`);
  expect(await play.text()).not.toContain("Blue box of bricks");
  await page.goto(`/h/${hunt.id}/s/${s.id}?k=${s.key}&preview=1`);
  expect(await page.content()).not.toContain("Blue box of bricks");
});

test("the treasure: noted in setup, last on the checklist, and a finish line on the last clue", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Treasure" } })).json();
  await page.goto(`/setup/hunts/${hunt.id}`);

  await page.getByLabel("Where you'll hide the final gift").fill("Behind the coats");
  await page.getByLabel(/^The final gift/).fill("Big red box");
  await page.getByLabel("Treasure message (optional)").fill("Happy birthday, Ren!");
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });
  const treasureRow = page.getByTestId("setup-checklist").locator('[data-station="treasure"]');
  await expect(treasureRow).toContainText("Behind the coats");
  await expect(treasureRow).toContainText("Big red box");

  // Play the last station's clue (preview marks it solved without saving) and cross the finish line.
  const saved = (await (await page.request.get(`/api/setup/hunts/${hunt.id}`)).json()).hunt;
  const last = saved.stations[saved.stations.length - 1];
  last.puzzle = { type: "memoryMatch", pairs: 6 };
  last.clue = { photoUrl: "/x.jpg", showText: false };
  expect((await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: saved })).ok()).toBe(true);
  await page.goto(`/h/${hunt.id}/s/${last.id}?k=${last.key}&preview=1`);
  expect(await page.content()).not.toContain("Big red box");
  expect(await page.content()).not.toContain("Behind the coats");
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await solveMemory(page);
  const found = page.getByRole("button", { name: "I found the treasure!" });
  await expect(found).toBeVisible({ timeout: 15_000 });
  await found.click();
  const finale = page.getByRole("dialog", { name: "You found the treasure!" });
  await expect(finale).toBeVisible();
  await expect(finale.getByText("Happy birthday, Ren!")).toBeVisible();
  await finale.getByRole("button", { name: "Back to the clue" }).click();
  await expect(finale).toHaveCount(0);
});
