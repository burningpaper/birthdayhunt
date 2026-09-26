import { expect, test, type Page } from "@playwright/test";
import { LIFT_PX } from "../src/puzzles/marble3d/constants";
import type { Placed } from "../src/puzzles/marble3d/levels";
import { placeMarblePiece, solveMarble } from "./solvers";

/** Marble Run (3D), played through the real drag, tap and GO controls. */

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

test("each star the marble rolls through lights up on the counter", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(await marbleStation(page, 3));
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await expect(page.getByRole("status", { name: "0 of 3 stars collected" })).toBeVisible();
  await solveMarble(page);
  await expect(page.getByRole("status", { name: "3 of 3 stars collected" })).toBeVisible({ timeout: 15_000 });
});

test("a miss flies off, then a new marble waits in the tube and the pieces stay put", async ({ page }) => {
  await page.goto(await marbleStation(page, 1));
  await page.getByRole("button", { name: "Tap to start!" }).click();

  // A curve under the tube that opens left and down, not up: the marble can't get in, and flies off.
  const curves = page.locator('button[data-piece][data-type="curve"]');
  await expect(curves).toHaveAttribute("data-left", "3");
  await placeMarblePiece(page, page, { col: 2, row: 0, type: "curve", turns: 0 });
  await expect(curves).toHaveAttribute("data-left", "2"); // one fewer in the tray
  await page.getByRole("button", { name: "GO: drop the marble" }).click();

  const run = page.locator("div.marble-run");
  await expect(run).toHaveAttribute("data-phase", "running");
  await expect(page.getByText("Whoops! Try again.")).toBeVisible({ timeout: 15_000 });
  await expect(run).toHaveAttribute("data-phase", "build", { timeout: 8_000 });
  await expect(page.locator('button.marble-cell[data-cell="2,0"]')).toHaveAttribute("data-type", "curve");
});

test("a run that lands in the bucket but skips a star doesn't count", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(await marbleStation(page, 1));
  await page.getByRole("button", { name: "Tap to start!" }).click();

  // Level 1's star is left of the drop; go straight down and along instead, missing it.
  const skipTheStar: Placed[] = [
    { col: 2, row: 0, type: "straight", turns: 1 },
    { col: 2, row: 1, type: "straight", turns: 1 },
    { col: 2, row: 2, type: "curve", turns: 2 },
    { col: 3, row: 2, type: "straight", turns: 0 },
  ];
  for (const want of skipTheStar) await placeMarblePiece(page, page, want);
  await page.getByRole("button", { name: "GO: drop the marble" }).click();

  await expect(page.getByText("So close! Collect every star first.")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("div.marble-run")).toHaveAttribute("data-phase", "build", { timeout: 8_000 });
  await expect(page.getByText("You did it!")).toHaveCount(0);
  await expect(page.locator("[data-stars]")).toHaveAttribute("data-stars", "0"); // the counter resets for the next go
});

test("after solving, Keep building! opens a free build on a bare board with endless pieces", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(await marbleStation(page, 1));
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await solveMarble(page);
  await expect(page.getByText("Go find it!")).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Keep building!" }).click();
  const sandbox = page.getByRole("dialog", { name: "Free build" });
  await expect(sandbox).toBeVisible();
  await expect(sandbox.locator("button[data-piece]")).toHaveCount(3);

  // A whole run from scratch on level 1's bare board: down from the tube, along the bottom, into the bucket.
  const route: Placed[] = [
    { col: 2, row: 0, type: "straight", turns: 1 },
    { col: 2, row: 1, type: "straight", turns: 1 },
    { col: 2, row: 2, type: "curve", turns: 2 },
    { col: 3, row: 2, type: "loop", turns: 0 },
  ];
  for (const want of route) await placeMarblePiece(sandbox, page, want);
  await expect(sandbox.locator("button[data-piece]")).toHaveCount(3); // the tray never runs out
  await sandbox.getByRole("button", { name: "GO: drop the marble" }).click();
  await expect(sandbox.getByText("In the bucket!")).toBeVisible({ timeout: 15_000 });
  await expect(sandbox.locator("div.marble-run")).toHaveAttribute("data-phase", "build", { timeout: 5_000 });

  await sandbox.getByRole("button", { name: "Back to the clue" }).click();
  await expect(sandbox).toHaveCount(0);
  await expect(page.getByText("Go find it!")).toBeVisible();
});

test("touching a tray piece lifts it above the finger straight away, and its tray spot stays", async ({ page }) => {
  await page.goto(await marbleStation(page, 1));
  await page.getByRole("button", { name: "Tap to start!" }).click();

  const piece = page.locator('button[data-piece][data-type="straight"]');
  const box = (await piece.boundingBox())!;
  const finger = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(finger.x, finger.y);
  await page.mouse.down();

  // Visible the moment it's touched, before any movement, and above the fingertip.
  const held = page.locator('[data-dragging="straight"]');
  await expect(held).toBeVisible();
  const heldBox = (await held.boundingBox())!;
  expect(heldBox.y + heldBox.height / 2).toBeLessThan(finger.y - LIFT_PX / 2);
  // The touched button is still in the page (iPad Safari drops a touch whose element vanishes).
  await expect(piece).toBeAttached();

  await page.mouse.move(finger.x - 200, finger.y - 150, { steps: 5 });
  await expect(held).toBeVisible();
  await page.mouse.up();
  await expect(held).toHaveCount(0);
});
