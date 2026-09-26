import { expect, test } from "@playwright/test";

/**
 * The parent PIN's rate limit. Only wrong PINs count: a parent signing in
 * on several devices must never be locked out (the old limit counted every
 * attempt, correct ones included). Each case uses its own client address.
 */

const RIGHT = "2468";
const login = (request: import("@playwright/test").APIRequestContext, pin: string, ip: string) =>
  request.post("/api/setup/login", { data: { pin }, headers: { "x-forwarded-for": ip } });

test("correct sign-ins never trip the limit", async ({ request }) => {
  for (let i = 0; i < 15; i++) expect((await login(request, RIGHT, "198.51.100.1")).status()).toBe(200);
});

test("ten wrong PINs lock that address out, even for the right PIN", async ({ request }) => {
  const ip = "198.51.100.2";
  for (let i = 0; i < 10; i++) expect((await login(request, "0000", ip)).status()).toBe(401);
  expect((await login(request, "0000", ip)).status()).toBe(429);
  expect((await login(request, RIGHT, ip)).status()).toBe(429);
  // Someone else isn't affected.
  expect((await login(request, RIGHT, "198.51.100.3")).status()).toBe(200);
});
