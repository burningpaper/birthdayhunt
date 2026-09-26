import { expect, test, type Page } from "@playwright/test";
import { solveMarble } from "./solvers";

/** Marble Run, played through the real drag, tap and GO controls. */

async function marbleStation(page: Page, level: number): Promise<string> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: `Marble ${level}` } })).json();
  hunt.stations[0].puzzle = { type: "marbleRun", level };
  hunt.stations[0].clue = { photoUrl: "/x.jpg", showText: false };
  expect((await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: hunt })).ok()).toBe(true);
  const s = hunt.stations[0];
  return `/h/${hunt.id}/s/${s.id}?k=${s.key}&preview=1`;
}

for (const level of [1, 3, 5]) {
  test(`level ${level} can be built and solved`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(await marbleStation(page, level));
    await page.getByRole("button", { name: "Tap to start!" }).click();
    await solveMarble(page);
    await expect(page.getByText("You did it!")).toBeVisible({ timeout: 20_000 });
  });
}

test("a miss rolls away, then the pieces stay put for another go", async ({ page }) => {
  await page.goto(await marbleStation(page, 1));
  await page.getByRole("button", { name: "Tap to start!" }).click();

  // Put the ramp in the wrong way up, then GO.
  const piece = page.locator('button[data-piece][data-type="ramp"]');
  const zone = page.locator('button.marble-zone[data-zone="0"]');
  const from = (await piece.boundingBox())!;
  const to = (await zone.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await zone.click(); // turn it 45°: now it points the marble the wrong way
  await zone.click();
  await page.getByRole("button", { name: "GO: drop the marble" }).click();

  await expect(page.getByText("Whoops! Try moving a piece.")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("canvas.marble-run")).toHaveAttribute("data-phase", "build", { timeout: 5_000 });
  await expect(zone).toHaveAttribute("data-type", "ramp");
});

test("after solving, Keep building! opens a free build with every piece", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(await marbleStation(page, 1));
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await solveMarble(page);
  await expect(page.getByText("Go find it!")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Keep building!" }).click();
  const sandbox = page.getByRole("dialog", { name: "Free build" });
  await expect(sandbox).toBeVisible();
  await expect(sandbox.locator("button[data-piece]")).toHaveCount(8);

  // Build level 1's run in the sandbox: landing in the cup cheers, then resets for more.
  await solveMarble(page);
  await expect(sandbox.getByText("In the cup!")).toBeVisible({ timeout: 15_000 });
  await expect(sandbox.locator("canvas.marble-run")).toHaveAttribute("data-phase", "build", { timeout: 5_000 });

  await sandbox.getByRole("button", { name: "Back to the clue" }).click();
  await expect(sandbox).toHaveCount(0);
  await expect(page.getByText("Go find it!")).toBeVisible();
});
