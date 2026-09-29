import { expect, type Locator, type Page } from "@playwright/test";
import { LIFT_PX } from "../../src/puzzles/marble3d/constants";
import { LEVELS, type Placed } from "../../src/puzzles/marble3d/levels";
import { makeMaze, type Cell } from "../../src/puzzles/maze/logic";
import { findSolution, turnsFor, type Kind } from "../../src/puzzles/track/logic";

/**
 * Solving each puzzle through the real UI, the way a child would, using the
 * data attributes each puzzle exposes for exactly this purpose.
 */

/**
 * Where a piece really is on the page. (A piece's bounding box can't be used:
 * for an SVG group it includes the whole unclipped photo.)
 */
async function pieceCentre(page: Page, piece: Locator) {
  const board = page.locator("svg.jigsaw");
  const svg = (await board.boundingBox())!;
  const [cellW, cellH] = (await board.getAttribute("data-cell"))!.split(",").map(Number);
  const at = await piece.evaluate((node) => {
    const m = new DOMMatrix(getComputedStyle(node).transform);
    return { x: m.e, y: m.f };
  });
  return { x: svg.x + at.x + cellW / 2, y: svg.y + at.y + cellH / 2, originX: at.x, originY: at.y };
}

async function turnUpright(page: Page, piece: Locator) {
  for (let taps = 0; taps < 4 && (await piece.getAttribute("data-turns")) !== "0"; taps++) {
    const centre = await pieceCentre(page, piece);
    await page.mouse.click(centre.x, centre.y);
    await page.waitForTimeout(280); // let the turn animation settle
  }
}

async function dragJigsawPieceHome(page: Page, piece: Locator) {
  await turnUpright(page, piece);
  const [homeX, homeY] = (await piece.getAttribute("data-home"))!.split(",").map(Number);
  const from = await pieceCentre(page, piece);
  const dx = homeX - from.originX;
  const dy = homeY - from.originY;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
  // Let React re-render and the snap animation finish before the next grab.
  await page.waitForTimeout(250);
}

export async function solveJigsaw(page: Page) {
  const loose = page.locator("g.jigsaw-piece[data-placed=false]");
  await expect(loose.first()).toBeVisible();
  for (let guard = 0; guard < 40 && (await loose.count()) > 0; guard++) {
    // Pin the piece by id: touching a piece moves it to the top of the pile
    // (the end of the DOM), so "the first loose piece" would change under us.
    const id = await loose.first().getAttribute("data-piece");
    await dragJigsawPieceHome(page, page.locator(`g.jigsaw-piece[data-piece="${id}"]`));
  }
  await expect(loose).toHaveCount(0);
}

export async function solveMemory(page: Page) {
  const cards = page.locator("button.memory-card");
  await expect(cards.first()).toBeVisible();
  const faces = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("data-face")!));
  const byFace = new Map<string, number[]>();
  faces.forEach((face, i) => byFace.set(face, [...(byFace.get(face) ?? []), i]));
  for (const [a, b] of byFace.values()) {
    await cards.nth(a).click();
    await cards.nth(b).click();
    await expect(cards.nth(b)).toHaveAttribute("data-matched", "true");
  }
}

/** Turn each wheel to its digit with the arrow buttons, then press Open. */
export async function solveLock(page: Page, answers: number[]) {
  const windows = page.locator(".dial-window");
  await expect(windows.first()).toBeVisible();
  const wheelTargets = (await windows.count()) === 2 && answers.length === 1 ? [Math.floor(answers[0] / 10), answers[0] % 10] : answers;
  for (const [wheel, target] of wheelTargets.entries()) {
    const window = page.locator(`.dial-window[data-wheel="${wheel}"]`);
    const up = page.locator("button[aria-label$=' up']").nth(wheel);
    for (let guard = 0; guard < 10 && Number(await window.getAttribute("data-value")) !== target; guard++) await up.click();
    await expect(window).toHaveAttribute("data-value", String(target));
  }
  await page.getByRole("button", { name: "Open!" }).click();
}

/** Read the tile kinds off the board, find a route, and tap each tile round to fit it. */
export async function solveTrack(page: Page) {
  const board = page.locator("[data-start][data-end]");
  const size = Number(await board.getAttribute("data-size"));
  const startRow = Number(await board.getAttribute("data-start"));
  const endRow = Number(await board.getAttribute("data-end"));
  const kinds: Kind[][] = Array.from({ length: size }, () => Array<Kind>(size));
  for (const tile of await page.locator(".track-tile").all()) {
    kinds[Number(await tile.getAttribute("data-y"))][Number(await tile.getAttribute("data-x"))] = (await tile.getAttribute("data-kind")) as Kind;
  }
  const needs = findSolution(kinds, startRow, endRow);
  expect(needs, "the board should be solvable").not.toBeNull();

  for (const [key, need] of needs!) {
    const [x, y] = key.split(",");
    const tile = page.locator(`.track-tile[data-x="${x}"][data-y="${y}"]`);
    const kind = kinds[Number(y)][Number(x)];
    if (kind === "cross") continue;
    const target = turnsFor(kind, need)!;
    const matches = async () => {
      const turns = Number(await tile.getAttribute("data-turns"));
      return kind === "straight" ? turns % 2 === target % 2 : turns === target;
    };
    for (let guard = 0; guard < 4 && !(await matches()); guard++) await tile.click();
  }
}

/** Play each hole's stored sinking shot as a real drag: grab the ball on the tee, pull back, let go. */
export async function solveGolf(page: Page) {
  const course = page.locator("canvas.golf-course");
  const holes = Number(await course.getAttribute("data-holes"));
  for (let hole = 0; hole < holes; hole++) {
    await expect(course).toHaveAttribute("data-hole", String(hole), { timeout: 10_000 });
    await expect(course).toHaveAttribute("data-at-rest", "true");
    const box = (await course.boundingBox())!;
    const scale = Number(await course.getAttribute("data-scale"));
    const [teeX, teeY] = (await course.getAttribute("data-tee"))!.split(",").map(Number);
    const [pullX, pullY] = (await course.getAttribute("data-test-shot"))!.split(",").map(Number);
    const from = { x: box.x + teeX * scale, y: box.y + teeY * scale };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + pullX * scale, from.y + pullY * scale, { steps: 8 });
    // A windmill: hold the aim, and let go when the blades are where the stored shot needs them.
    const phase = await course.getAttribute("data-test-phase");
    if (phase) {
      const [period, lo, hi] = phase.split(",").map(Number);
      const mid = Math.round((lo + hi) / 2);
      await page.waitForFunction(
        ([p, m]) => {
          const tick = Number(document.querySelector<HTMLCanvasElement>("canvas.golf-course")?.dataset.tick ?? -1);
          return (((tick - m) % p) + p) % p <= 1 || (((m - tick) % p) + p) % p <= 1;
        },
        [period, mid - 1] as const,
        { polling: "raf" },
      );
    }
    await page.mouse.up();
    if (hole < holes - 1) await expect(course).toHaveAttribute("data-hole", String(hole + 1), { timeout: 15_000 });
  }
}

/** Build the level's intended run through the UI: drag each piece into its zone, turn it, press GO. */
/** Drag a marble run piece from the tray into a square, then tap it round to the wanted turn. */
export async function placeMarblePiece(root: Page | Locator, page: Page, want: Placed) {
  const piece = root.locator(`button[data-piece][data-type="${want.type}"]`).first();
  const cell = root.locator(`button.marble-cell[data-cell="${want.col},${want.row}"]`);
  const from = (await piece.boundingBox())!;
  const to = (await cell.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // A dragged piece floats above the finger, so the finger goes below the square's centre.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + LIFT_PX, { steps: 10 });
  await page.mouse.up();
  await expect(cell).toHaveAttribute("data-type", want.type);
  for (let taps = 0; taps < 4 && Number(await cell.getAttribute("data-turns")) !== want.turns; taps++) await cell.click();
  await expect(cell).toHaveAttribute("data-turns", String(want.turns));
}

/** Solve every level of a marble run station in turn (a station can play several in a row). */
export async function solveMarble(page: Page) {
  const run = page.locator("div.marble-run");
  const total = Number(await run.getAttribute("data-levels"));
  for (let i = 0; i < total; i++) {
    await expect(run).toHaveAttribute("data-level-index", String(i), { timeout: 15_000 });
    await expect(run).toHaveAttribute("data-phase", "build");
    const level = LEVELS[Number(await run.getAttribute("data-level")) - 1];
    for (const want of level.solution) await placeMarblePiece(page, page, want);
    await page.getByRole("button", { name: "GO: drop the marble" }).click();
  }
}

/** Where maze cells are on screen (cell units are the maze SVG's own coordinates). */
export async function mazeCellsOnScreen(page: Page, cells: Cell[]) {
  return page.evaluate((cs) => {
    const svg = document.querySelector<SVGSVGElement>("svg.maze")!;
    const m = svg.getScreenCTM()!;
    return cs.map(({ c, r }) => new DOMPoint(c + 0.5, r + 0.5).matrixTransform(m)).map((p) => ({ x: p.x, y: p.y }));
  }, cells);
}

/** Draw the one route from the cat's mouth to its tummy, as a finger would. */
export async function solveMaze(page: Page) {
  const svg = page.locator("svg.maze");
  await expect(svg).toBeVisible();
  const maze = makeMaze(Number(await svg.getAttribute("data-grid")), Number(await svg.getAttribute("data-seed")));
  const points = await mazeCellsOnScreen(page, maze.solution);
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.up();
}

/** Solve whatever puzzle this station shows. Lock answers come from the test's own hunt setup. */
export async function solveAny(page: Page, lockAnswers: number[] = [2, 2, 2]) {
  // Puzzles fade in after "Tap to start": wait until one is actually on screen.
  const anyPuzzle = page.locator("svg.jigsaw, button.memory-card, .dial-window, .track-tile, canvas.golf-course, div.marble-run, svg.maze");
  await expect(anyPuzzle.first()).toBeVisible();
  if (await page.locator("svg.jigsaw").isVisible()) return solveJigsaw(page);
  if (await page.locator("button.memory-card").first().isVisible()) return solveMemory(page);
  if (await page.locator(".dial-window").first().isVisible()) return solveLock(page, lockAnswers);
  if (await page.locator(".track-tile").first().isVisible()) return solveTrack(page);
  if (await page.locator("canvas.golf-course").isVisible()) return solveGolf(page);
  if (await page.locator("div.marble-run").isVisible()) return solveMarble(page);
  if (await page.locator("svg.maze").isVisible()) return solveMaze(page);
  throw new Error("No puzzle found on this station");
}
