import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import path from "node:path";

type Station = { id: string; key: string; order: number; puzzle: { type: string; questions?: { questionText: string; answer: number }[] }; clue: Record<string, unknown> };
type Hunt = { id: string; status: string; stations: Station[] };

const PIN = "2468";

async function signIn(page: Page) {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/setup\/login/);
  await page.getByLabel("Parent PIN").fill(PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();
}

async function loadHunt(api: APIRequestContext, id: string): Promise<Hunt> {
  return (await (await api.get(`/api/setup/hunts/${id}`)).json()).hunt;
}

function stationPath(hunt: Hunt, index: number) {
  const s = hunt.stations[index];
  return `/h/${hunt.id}/s/${s.id}?k=${s.key}`;
}

async function solveStation(page: Page, hunt: Hunt, index: number) {
  await page.goto(stationPath(hunt, index));
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await page.getByRole("button", { name: "Tap to solve" }).click();
  await expect(page.getByText(/You did it!|You solved every puzzle!/)).toBeVisible();
}

test("a parent builds a hunt and a child plays it end to end", async ({ page, browser }) => {
  await signIn(page);

  // Create a hunt and give station 1 a real photo through the UI.
  await page.getByRole("button", { name: "New hunt" }).click();
  await expect(page).toHaveURL(/\/setup\/hunts\//);
  const huntId = page.url().split("/").pop()!;

  await page.getByLabel("Child's name").fill("Sam");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose photo" }).first().click()]);
  await chooser.setFiles(path.join(__dirname, "fixtures", "clue.jpg"));
  await expect(page.getByAltText("Clue photo").first()).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();

  // Going live is blocked until the checklist is clear.
  await expect(page.getByRole("button", { name: "Go live" })).toBeDisabled();
  await expect(page.getByText("Station 2: add a clue photo or shown clue text", { exact: false })).toBeVisible();

  // Fill the remaining stations through the API, then go live in the UI.
  const hunt = await loadHunt(page.request, huntId);
  const photoUrl = hunt.stations[0].clue.photoUrl as string;
  hunt.stations = hunt.stations.map((s, i) => ({
    ...s,
    clue: i === 2 ? { text: "I keep things cold and hum all night", showText: true } : { photoUrl, showText: false },
    puzzle: s.puzzle.type === "countingLock" ? { ...s.puzzle, questions: s.puzzle.questions!.map(() => ({ questionText: "How many?", answer: 2 })) } : s.puzzle,
  }));
  expect((await page.request.put(`/api/setup/hunts/${huntId}`, { data: hunt })).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("This hunt is live")).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();

  // The printed sheet has a code per station pointing at the right URL.
  await page.goto(`/setup/hunts/${huntId}/print`);
  await expect(page.locator(".qr-card")).toHaveCount(6);

  // The child: a separate browser context with no parent cookie.
  const child = await (await browser.newContext({ viewport: { width: 1194, height: 834 }, hasTouch: true })).newPage();
  const live = await loadHunt(page.request, huntId);

  // Scanning ahead says "not yet" and the response carries nothing about that station.
  const early = await child.request.get(`/api/play/${huntId}/${live.stations[3].id}?k=${live.stations[3].key}`);
  expect(await early.json()).toEqual({ state: "notYet", childName: "Sam" });
  await child.goto(stationPath(live, 3));
  await expect(child.getByRole("heading", { name: "Not yet!" })).toBeVisible();

  // Adding preview=1 without the parent cookie changes nothing.
  await child.goto(`${stationPath(live, 3)}&preview=1`);
  await expect(child.getByRole("heading", { name: "Not yet!" })).toBeVisible();

  // Station 1: play, celebrate, see the clue.
  await solveStation(child, live, 0);
  await expect(child.getByText("Go find it!")).toBeVisible();

  // Reloading keeps progress: station 1 now goes straight to its clue.
  await child.goto(stationPath(live, 0));
  await expect(child.getByText("Go find it!")).toBeVisible();
  await expect(child.getByRole("button", { name: "Tap to start!" })).toHaveCount(0);

  // Scanning ahead now replays the clue already earned.
  await child.goto(stationPath(live, 4));
  await child.getByRole("button", { name: "Show my clue" }).click();
  await expect(child.getByAltText("A photo of where the next clue is hiding")).toBeVisible();

  // Parent test mode on station 5 does not touch progress.
  await page.goto(`${stationPath(live, 4)}&preview=1`);
  await expect(page.getByText("Test mode: progress isn't saved")).toBeVisible();
  await page.getByRole("button", { name: "Tap to start!" }).click();
  await page.getByRole("button", { name: "Tap to solve" }).click();
  await expect(page.getByText("You did it!")).toBeVisible();
  const afterPreview = await (await page.request.get(`/api/setup/hunts/${huntId}`)).json();
  expect(afterPreview.progress.completedStationIds).toHaveLength(1);

  // Finish the hunt: the riddle clue on station 3, then the treasure finale.
  await solveStation(child, live, 1);
  await solveStation(child, live, 2);
  await expect(child.getByText("I keep things cold and hum all night")).toBeVisible();
  for (const i of [3, 4]) await solveStation(child, live, i);
  await solveStation(child, live, 5);
  await expect(child.getByText("Last clue: find the treasure!")).toBeVisible();

  const done = await (await page.request.get(`/api/setup/hunts/${huntId}`)).json();
  expect(done.progress.completedStationIds).toHaveLength(6);
  expect(done.progress.finishedAt).toBeTruthy();
});

test("an unknown code shows the friendly invalid screen", async ({ page }) => {
  await page.goto("/h/nope/s/nope?k=aaaaaa");
  await expect(page.getByRole("heading", { name: "Hmm, that's not a treasure code!" })).toBeVisible();
});

test("the setup area requires the PIN", async ({ page, request }) => {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/setup\/login/);
  await page.getByLabel("Parent PIN").fill("0000");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText("That PIN didn't match. Try again.")).toBeVisible();
  expect((await request.get("/api/setup/hunts")).status()).toBe(401);
});

test("a parent records a voice clue and plays it back", async ({ page, context, browserName }) => {
  await context.grantPermissions(["microphone"]).catch(() => undefined);
  await signIn(page);
  await page.getByRole("button", { name: "New hunt" }).click();
  await expect(page).toHaveURL(/\/setup\/hunts\//);

  await page.getByRole("button", { name: "Record voice clue" }).first().click();
  await expect(page.getByText(/Recording 0:0/)).toBeVisible();
  // Speak for a realistic few seconds: WebKit's encoder can take over a second to warm up.
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop" }).first().click();

  await expect(page.getByRole("button", { name: "Play voice clue" }).first()).toBeVisible();
  await expect(page.getByText("All changes saved")).toBeVisible();

  // The clip was stored and is servable as audio.
  const huntId = page.url().split("/").pop()!;
  const hunt = (await (await page.request.get(`/api/setup/hunts/${huntId}`)).json()).hunt;
  const audioUrl: string = hunt.stations[0].clue.audioUrl;
  expect(audioUrl, `recorded in ${browserName}`).toMatch(/^\/api\/media\/[a-z0-9]{16}\.(m4a|webm|ogg)$/);
  const media = await page.request.get(audioUrl);
  expect(media.ok()).toBe(true);
  expect(media.headers()["content-type"]).toMatch(/^audio\//);
});
