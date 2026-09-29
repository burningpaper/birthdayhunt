import { expect, test, type Page } from "@playwright/test";
import { makeMaze, passable } from "../src/puzzles/maze/logic";
import { mazeCellsOnScreen, solveMaze } from "./solvers";

/** Cat Maze: a fish guided with a finger, in through the cat's mouth and on to its tummy. */

async function mazeStation(page: Page, grid: 15 | 19 | 25, seed = 4242): Promise<string> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Maze" } })).json();
  hunt.stations[0].puzzle = { type: "maze", grid, seed };
  hunt.stations[0].clue = { photoUrl: "/x.jpg", showText: false };
  expect((await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: hunt })).ok()).toBe(true);
  const s = hunt.stations[0];
  return `/h/${hunt.id}/s/${s.id}?k=${s.key}&preview=1`;
}

for (const grid of [15, 25] as const) {
  test(`a ${grid}-across cat maze can be drawn from mouth to tummy`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(await mazeStation(page, grid));
    await page.getByRole("button", { name: "Tap to start!" }).click();
    await solveMaze(page);
    await expect(page.locator("svg.maze")).toHaveAttribute("data-solved", "true");
    await expect(page.getByText("You did it!")).toBeVisible({ timeout: 10_000 });
  });
}

test("the line keeps to the corridors, can be rubbed out, and carries on after lifting the finger", async ({ page }) => {
  await page.goto(await mazeStation(page, 19));
  await page.getByRole("button", { name: "Tap to start!" }).click();
  const svg = page.locator("svg.maze");
  await expect(svg).toBeVisible();
  const maze = makeMaze(19, 4242);
  const route = maze.solution;
  const pts = await mazeCellsOnScreen(page, route.slice(0, 6));

  // Start away from the mouth: nothing is drawn.
  const [far] = await mazeCellsOnScreen(page, [maze.tummy]);
  await page.mouse.move(far.x, far.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(svg).toHaveAttribute("data-path", "0");

  // Draw five steps along the route, lift, then carry on from the end.
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1, 5)) await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.up();
  await expect(svg).toHaveAttribute("data-path", "5");
  await page.mouse.move(pts[4].x, pts[4].y);
  await page.mouse.down();
  await page.mouse.move(pts[5].x, pts[5].y, { steps: 2 });
  // Rub back to the second cell.
  for (const p of [pts[4], pts[3], pts[2], pts[1]]) await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.up();
  await expect(svg).toHaveAttribute("data-path", "2");

  // A neighbour of the end behind a wall (whose way round is long) can't be drawn into.
  const end = route[1];
  const blocked = [
    { c: end.c + 1, r: end.r },
    { c: end.c - 1, r: end.r },
    { c: end.c, r: end.r + 1 },
    { c: end.c, r: end.r - 1 },
  ].find((n) => maze.inside[n.r]?.[n.c] && !passable(maze, end, n));
  if (blocked) {
    const [b] = await mazeCellsOnScreen(page, [blocked]);
    const [e] = await mazeCellsOnScreen(page, [end]);
    await page.mouse.move(e.x, e.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 2 });
    await page.mouse.up();
    const drawn = Number(await svg.getAttribute("data-path"));
    expect(drawn === 2 || drawn > 3, "only through the corridor, never the wall").toBe(true);
  }
});

test("the fish waits outside the mouth: pick it up and swim it in", async ({ page }) => {
  await page.goto(await mazeStation(page, 19));
  await page.getByRole("button", { name: "Tap to start!" }).click();
  const svg = page.locator("svg.maze");
  await expect(svg).toBeVisible();
  const maze = makeMaze(19, 4242);
  const [fx, fy] = (await svg.getAttribute("data-fish"))!.split(",").map(Number);
  const fish = await page.evaluate(([x, y]) => {
    const p = new DOMPoint(x, y).matrixTransform(document.querySelector<SVGSVGElement>("svg.maze")!.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, [fx, fy]);
  const route = await mazeCellsOnScreen(page, maze.solution.slice(0, 4));
  await page.mouse.move(fish.x, fish.y);
  await page.mouse.down();
  for (const p of route) await page.mouse.move(p.x, p.y, { steps: 4 });
  await page.mouse.up();
  await expect(svg).toHaveAttribute("data-path", "4");
});
