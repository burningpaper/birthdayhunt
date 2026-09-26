import { expect, test } from "@playwright/test";
import { solveGolf } from "./solvers";

/** Flick Golf, played through the real drag-and-release UI. */

test("a three-hole golf station can be played to the celebration", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Golf" } })).json();
  const station = hunt.stations.find((s: { puzzle: { type: string } }) => s.puzzle.type === "flickGolf");
  expect(station, "new hunts include a golf station").toBeTruthy();
  expect(station.puzzle.holes).toBe(3);

  await page.goto(`/h/${hunt.id}/s/${station.id}?k=${station.key}&preview=1`);
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await expect(page.getByText("Hole 1 of 3")).toBeVisible();
  await solveGolf(page);
  await expect(page.getByText("You did it!")).toBeVisible({ timeout: 15_000 });
});

test("a tiny accidental tug on the ball doesn't take a shot", async ({ page }) => {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Golf aim" } })).json();
  const station = hunt.stations.find((s: { puzzle: { type: string } }) => s.puzzle.type === "flickGolf");
  await page.goto(`/h/${hunt.id}/s/${station.id}?k=${station.key}&preview=1`);
  await page.getByRole("button", { name: "Tap to start!" }).click();

  const course = page.locator("canvas.golf-course");
  await expect(course).toBeVisible();
  const box = (await course.boundingBox())!;
  const scale = Number(await course.getAttribute("data-scale"));
  const [x, y] = (await course.getAttribute("data-tee"))!.split(",").map(Number);
  await page.mouse.move(box.x + x * scale, box.y + y * scale);
  await page.mouse.down();
  await page.mouse.move(box.x + (x - 4) * scale, box.y + (y + 3) * scale);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(course).toHaveAttribute("data-at-rest", "true");
});
