import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { solveJigsaw } from "./solvers";

/** The jigsaw's mystery close-up: picked in the editor, zooming out when solved. */

const PIN = "2468";
const photo = path.join(__dirname, "fixtures", "clue.jpg");

async function editorWithPhoto(page: Page): Promise<string> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await page.getByRole("button", { name: "New hunt" }).click();
  await expect(page).toHaveURL(/\/setup\/hunts\//);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).first().click()]);
  await chooser.setFiles(photo);
  await expect(page.getByAltText("Clue photo").first()).toBeVisible();
  return page.url().split("/").pop()!;
}

const storedPuzzle = async (page: Page, id: string) => (await (await page.request.get(`/api/setup/hunts/${id}`)).json()).hunt.stations[0].puzzle;

test("a parent picks a close-up by dragging and zooming, and it's saved", async ({ page }) => {
  const id = await editorWithPhoto(page);
  await page.getByRole("radio", { name: "Mystery close-up" }).click();
  const box = page.getByRole("button", { name: /^Close-up,/ });
  await expect(box).toBeVisible();

  // Drag the box up and to the left, then pull in closer.
  const b = (await box.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 60, b.y + b.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("slider", { name: "How close" }).fill("0.5"); // size 0.4 -> 0.4 (0.2 + 0.7 - 0.5)
  await page.getByRole("slider", { name: "How close" }).fill("0.6"); // closer: size 0.3
  await expect(page.getByText("All changes saved")).toBeVisible();

  const puzzle = await storedPuzzle(page, id);
  expect(puzzle.crop.size).toBeCloseTo(0.3, 2);
  expect(puzzle.crop.x).toBeLessThan(0.35); // moved left of the centred default
  expect(puzzle.crop.x + puzzle.crop.size).toBeLessThanOrEqual(1);

  // A new photo starts again from the whole picture.
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).first().click()]);
  await chooser.setFiles(photo);
  await expect(page.getByRole("radio", { name: "Whole photo" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("All changes saved")).toBeVisible();
  expect((await storedPuzzle(page, id)).crop).toBeUndefined();
});

test("solving a close-up zooms out to the whole photo before the celebration", async ({ page }) => {
  test.setTimeout(60_000);
  const id = await editorWithPhoto(page);
  await page.getByRole("radio", { name: "Mystery close-up" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();
  const hunt = (await (await page.request.get(`/api/setup/hunts/${id}`)).json()).hunt;
  const s = hunt.stations[0];

  await page.goto(`/h/${id}/s/${s.id}?k=${s.key}&preview=1`);
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await solveJigsaw(page);
  await expect(page.locator('[data-reveal="zoom"]')).toBeVisible();
  await expect(page.getByText("You did it!")).toBeVisible({ timeout: 10_000 });
});
