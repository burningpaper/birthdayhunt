import { expect, test } from "@playwright/test";

/** Testing a live hunt, then setting every puzzle back to unsolved before the real day. */

test("resetting from the hunt list puts every puzzle back to unsolved", async ({ page, browser }) => {
  await page.goto("/setup/login");
  await page.getByLabel("Parent PIN").fill("2468");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: "Your hunts" })).toBeVisible();

  // A live hunt with station 1 already solved, as after a test run.
  const { hunt } = await (await page.request.post("/api/setup/hunts", { data: { title: "Reset me" } })).json();
  hunt.stations = hunt.stations.map((s: { puzzle: { type: string; questions?: unknown[] } }) => ({
    ...s,
    clue: { photoUrl: "/api/media/aaaaaaaaaaaaaaaa.jpg", showText: false },
    puzzle: s.puzzle.type === "countingLock" ? { ...s.puzzle, questions: s.puzzle.questions!.map(() => ({ questionText: "How many?", answer: 2 })) } : s.puzzle,
  }));
  hunt.status = "active";
  expect((await page.request.put(`/api/setup/hunts/${hunt.id}`, { data: hunt })).ok()).toBe(true);
  const [first, second] = hunt.stations;
  const child = await browser.newContext();
  expect((await child.request.post(`/api/play/${hunt.id}/${first.id}/solve?k=${first.key}`)).ok()).toBe(true);

  await page.reload();
  const row = page.locator("section", { hasText: "Reset me" });
  await expect(row.getByText("1 / 6 found")).toBeVisible();
  await row.getByRole("button", { name: "Reset progress for Reset me" }).click();
  await row.getByRole("button", { name: "Yes, reset" }).click();
  await expect(row.getByText("0 / 6 found")).toBeVisible();

  // Station 1 plays its puzzle again, and station 2 is locked until then.
  const kid = await child.newPage();
  await kid.goto(`/h/${hunt.id}/s/${first.id}?k=${first.key}`);
  await expect(kid.getByRole("button", { name: "Tap to start!" })).toBeVisible();
  await kid.goto(`/h/${hunt.id}/s/${second.id}?k=${second.key}`);
  await expect(kid.getByRole("heading", { name: "Not yet!" })).toBeVisible();
  await child.close();
});
