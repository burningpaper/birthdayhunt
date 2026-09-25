import { expect, type Locator, type Page } from "@playwright/test";

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

export async function solvePlaceholder(page: Page) {
  await page.getByRole("button", { name: "Tap to solve" }).click();
}

/** Solve whatever puzzle this station shows. */
export async function solveAny(page: Page) {
  if (await page.locator("svg.jigsaw").isVisible()) return solveJigsaw(page);
  return solvePlaceholder(page);
}
