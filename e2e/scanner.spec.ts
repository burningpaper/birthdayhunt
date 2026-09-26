import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import QRCode from "qrcode";

/**
 * The in-page scanner, end to end. A real camera can't be pointed at a
 * code in CI, so the page's camera is replaced with a canvas showing a QR
 * code (canvas.captureStream), which runs the real decode and navigation.
 */

const PIN = "2468";

// Extra contexts run a fake camera and a live scanner; close them so they
// don't keep burning CPU (and slowing later tests) after each test ends.
const extraContexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(extraContexts.splice(0).map((context) => context.close()));
});

async function childContext(browser: import("@playwright/test").Browser) {
  const context = await browser.newContext({ viewport: { width: 1194, height: 834 } });
  extraContexts.push(context);
  return context;
}

async function fakeCameraShowing(context: BrowserContext, text: string) {
  const image = await QRCode.toDataURL(text, { margin: 4, width: 480 });
  await context.addInitScript((src) => {
    // On the prototype: WebKit ignores assigning over navigator.mediaDevices.getUserMedia.
    MediaDevices.prototype.getUserMedia = async function () {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.src = src;
      await img.decode();
      const draw = () => {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 640, 480);
        ctx.drawImage(img, 80, 0, 480, 480);
      };
      draw();
      setInterval(draw, 100);
      return canvas.captureStream(10);
    };
  }, image);
}

async function liveStationUrl(page: Page): Promise<string> {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Scan test" } })).json();
  hunt.stations = hunt.stations.map((s: { puzzle: { type: string; questions?: unknown[] } }) => ({
    ...s,
    clue: { photoUrl: "/api/media/aaaaaaaaaaaaaaaa.jpg", showText: false },
    puzzle: s.puzzle.type === "countingLock" ? { ...s.puzzle, questions: s.puzzle.questions!.map(() => ({ questionText: "How many?", answer: 2 })) } : s.puzzle,
  }));
  hunt.status = "active";
  expect((await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: hunt })).ok()).toBe(true);
  const s = hunt.stations[0];
  return `https://birthdayhunt-phi.vercel.app/h/${hunt.id}/s/${s.id}?k=${s.key}`;
}

test("scanning a treasure code opens its station", async ({ page, browser }) => {
  const printed = await liveStationUrl(page);
  const child = await childContext(browser);
  await fakeCameraShowing(child, printed);
  const kid = await child.newPage();

  await kid.goto("/");
  await kid.getByRole("button", { name: "Scan a code!" }).click();
  await expect(kid).toHaveURL(new URL(printed).pathname + new URL(printed).search, { timeout: 15_000 });
  await expect(kid.getByRole("button", { name: "Tap to start!" })).toBeVisible();
});

test("scanning someone else's QR code says it isn't a treasure code", async ({ browser }) => {
  const child = await childContext(browser);
  await fakeCameraShowing(child, "https://example.com/menu");
  const kid = await child.newPage();

  await kid.goto("/");
  await kid.getByRole("button", { name: "Scan a code!" }).click();
  await expect(kid.getByText("Hmm, that's not a treasure code!")).toBeVisible({ timeout: 15_000 });
  await expect(kid).toHaveURL("/");
  await kid.getByRole("button", { name: "Close the scanner" }).click();
  await expect(kid.getByRole("dialog")).toHaveCount(0);
});

test("a blocked camera explains how to allow it", async ({ browser }) => {
  const child = await childContext(browser);
  await child.addInitScript(() => {
    MediaDevices.prototype.getUserMedia = async function () {
      throw new DOMException("Permission denied", "NotAllowedError");
    };
  });
  const kid = await child.newPage();
  await kid.goto("/");
  await kid.getByRole("button", { name: "Scan a code!" }).click();
  await expect(kid.getByRole("heading", { name: "The camera is shy!" })).toBeVisible();
  await expect(kid.getByText("Website Settings")).toBeVisible();
});
