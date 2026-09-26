import { expect, test, type Page } from "@playwright/test";

/**
 * The printable QR sheet. Codes used to be cut in half across pages: grid
 * items don't fragment reliably, and the editor's padding still printed.
 * Now each group of codes is its own A4-sized sheet with a page break after.
 */

const PIN = "2468";
const A4_PRINTABLE_PX = (276 / 25.4) * 96; // 276mm at 96 CSS px per inch

async function printPage(page: Page, query = ""): Promise<number> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Print" } })).json();
  await page.goto(`/setup/hunts/${hunt.id}/print${query}`);
  await page.emulateMedia({ media: "print" });
  return hunt.stations.length;
}

async function sheets(page: Page) {
  return page.locator(".print-sheet").evaluateAll((els) =>
    els.map((sheet) => {
      const box = sheet.getBoundingClientRect();
      const cards = [...sheet.querySelectorAll(".qr-card")].map((c) => c.getBoundingClientRect());
      return {
        height: box.height,
        breakAfter: getComputedStyle(sheet).breakAfter,
        cards: cards.length,
        cardsInside: cards.every((c) => c.top >= box.top - 0.5 && c.bottom <= box.bottom + 0.5),
      };
    }),
  );
}

for (const [label, query, perSheet] of [
  ["two codes per page", "", 2],
  ["four codes per page", "?size=quarter", 4],
] as const) {
  test(`prints ${label}, each page whole`, async ({ page }) => {
    const codes = await printPage(page, query);
    const result = await sheets(page);

    expect(result).toHaveLength(Math.ceil(codes / perSheet));
    result.forEach((sheet, i) => {
      expect(sheet.height).toBeCloseTo(A4_PRINTABLE_PX, 0);
      expect(sheet.cardsInside).toBe(true);
      expect(sheet.cards).toBe(i < result.length - 1 ? perSheet : codes - perSheet * (result.length - 1));
      expect(sheet.breakAfter).toBe(i < result.length - 1 ? "page" : "auto");
    });
    // The editor's chrome doesn't print.
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  });
}
