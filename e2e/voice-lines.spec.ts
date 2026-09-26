import { expect, test, type Page } from "@playwright/test";

/** Voice lines: the parent's own recordings replace text-to-speech everywhere. */

const PIN = "2468";

async function huntWithTrackFirst(page: Page) {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Voices" } })).json();
  hunt.stations[0].puzzle = { type: "trainTrack", gridSize: 4 };
  hunt.stations[0].clue = { photoUrl: "/x.jpg", showText: false };
  const saved = await (await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: hunt })).json();
  return saved.hunt;
}

// Count any use of the browser's speech engine: there should never be one.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { spoken: number }).spoken = 0;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.speak = () => {
        (window as unknown as { spoken: number }).spoken++;
      };
    }
  });
});

test("a parent uploads voice lines, and the station plays them instead of a robot voice", async ({ page }) => {
  const hunt = await huntWithTrackFirst(page);
  await page.goto(`/setup/hunts/${hunt.id}`);

  const panel = page.getByTestId("voice-lines");
  await panel.getByText("Voice lines").click(); // open it
  await expect(panel.getByText("0 of 17 added")).toBeVisible();

  const instruction = panel.locator('[data-voice-line="instruction.trainTrack"]');
  await instruction.getByTestId("upload-line").setInputFiles({ name: "Tap the tracks.MP3", mimeType: "audio/mpeg", buffer: Buffer.from("ID3 not really an mp3") });
  await expect(instruction.getByRole("button", { name: "Play line" })).toBeVisible();
  await expect(panel.getByText("1 of 17 added")).toBeVisible();

  // Something that isn't audio is refused, kindly.
  const cheer = panel.locator('[data-voice-line="celebrate.station"]');
  await cheer.getByTestId("upload-line").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from("jpeg") });
  await expect(cheer.getByRole("alert")).toHaveText(/MP3, M4A, WAV or AAC/);

  // Saved with the hunt.
  await expect(page.getByText("All changes saved")).toBeVisible({ timeout: 10_000 });
  const stored = (await (await page.request.get(`/api/setup/hunts/${hunt.id}`)).json()).hunt;
  const url: string = stored.voiceLines["instruction.trainTrack"];
  expect(url).toMatch(/^\/api\/media\/[a-z0-9]{16}\.mp3$/);

  // Playing the station fetches that recording the moment the child taps start.
  const s = stored.stations[0];
  const fetched = page.waitForRequest((r) => r.url().endsWith(url));
  await page.goto(`/h/${hunt.id}/s/${s.id}?k=${s.key}&preview=1`);
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await fetched;
  await expect(page.getByRole("button", { name: "Say it again" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { spoken: number }).spoken)).toBe(0);
});

test("with no voice lines, nothing is spoken and there's no speaker button to press", async ({ page }) => {
  const hunt = await huntWithTrackFirst(page);
  const s = hunt.stations[0];
  await page.goto(`/h/${hunt.id}/s/${s.id}?k=${s.key}&preview=1`);
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await expect(page.locator(".track-tile").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Say it again" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { spoken: number }).spoken)).toBe(0);
});
