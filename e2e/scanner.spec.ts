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

/**
 * The front page's scan button. While a hunt is live (an earlier test may
 * have left one live) the front page is the start screen, whose big red
 * button opens the same scanner.
 */
function frontPageScanButton(kid: Page) {
  return kid.getByRole("button", { name: /^(Scan a code!|Start the treasure hunt)$/ });
}

/** A WAV of silence, `seconds` long: real audio the page can play to the end. */
function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const samples = Math.round(rate * seconds);
  const wav = Buffer.alloc(44 + samples);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + samples, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34); // 8-bit
  wav.write("data", 36);
  wav.writeUInt32LE(samples, 40);
  wav.fill(128, 44); // 8-bit silence sits at the midpoint
  return wav;
}

async function liveStationUrl(page: Page, welcomeSeconds?: number): Promise<string> {
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
  if (welcomeSeconds) {
    const upload = await page.request.post("/api/setup/upload-local", { headers: { "content-type": "audio/wav" }, data: silentWav(welcomeSeconds) });
    hunt.voiceLines = { "start.welcome": (await upload.json()).url };
  }
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
  await frontPageScanButton(kid).click();
  await expect(kid).toHaveURL(new URL(printed).pathname + new URL(printed).search, { timeout: 15_000 });
  await expect(kid.getByRole("button", { name: "Tap to start!" })).toBeVisible();
});

test("scanning someone else's QR code says it isn't a treasure code", async ({ browser }) => {
  const child = await childContext(browser);
  await fakeCameraShowing(child, "https://example.com/menu");
  const kid = await child.newPage();

  await kid.goto("/");
  await frontPageScanButton(kid).click();
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
  await frontPageScanButton(kid).click();
  await expect(kid.getByRole("heading", { name: "The camera is shy!" })).toBeVisible();
  await expect(kid.getByText("Website Settings")).toBeVisible();
});

test("while a hunt is live, the front page is its start screen: the welcome plays, then the scanner opens", async ({ page, browser }) => {
  const printed = await liveStationUrl(page, 1);
  const hunt = new URL(printed).pathname.split("/")[2];
  const welcome: string = (await (await page.request.get(`/api/setup/hunts/${hunt}`)).json()).hunt.voiceLines["start.welcome"];
  const child = await childContext(browser);
  await fakeCameraShowing(child, printed);
  const kid = await child.newPage();

  await kid.goto("/");
  const red = kid.getByRole("button", { name: "Start the treasure hunt" });
  const played = kid.waitForRequest((r) => r.url().endsWith(welcome));
  await red.click();
  await played;
  await expect(kid.getByRole("button", { name: "Skip to the scanner" })).toBeVisible(); // the message is playing
  // …and when it ends, the scanner opens and reads the first code (so fast the station may already be showing).
  await expect(kid).toHaveURL(new URL(printed).pathname + new URL(printed).search, { timeout: 15_000 });
  await expect(kid.getByRole("button", { name: "Tap to start!" })).toBeVisible();
});

test("pressing the red button again skips the rest of the welcome", async ({ page, browser }) => {
  await liveStationUrl(page, 30);
  const child = await childContext(browser);
  await fakeCameraShowing(child, "https://example.com/not-ours");
  const kid = await child.newPage();

  await kid.goto("/");
  await kid.getByRole("button", { name: "Start the treasure hunt" }).click();
  await kid.getByRole("button", { name: "Skip to the scanner" }).click();
  await expect(kid.getByRole("dialog")).toBeVisible({ timeout: 2_000 }); // long before the 30s message would end

  // Closing the scanner goes back to the big red button, ready to start again.
  await kid.getByRole("button", { name: "Close the scanner" }).click();
  await expect(kid.getByRole("button", { name: "Start the treasure hunt" })).toBeVisible();
});
