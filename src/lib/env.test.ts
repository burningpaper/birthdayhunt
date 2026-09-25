import { describe, expect, it } from "vitest";
import { authConfigProblems, firstSet, redisCredentials } from "./env";

describe("firstSet", () => {
  it("skips blank and whitespace-only values", () => {
    expect(firstSet({ A: "", B: "   ", C: "yes" }, ["A", "B", "C"])).toBe("yes");
    expect(firstSet({ A: "" }, ["A"])).toBeUndefined();
  });
});

describe("redisCredentials", () => {
  it("falls back to the prefixed Upstash names when the plain ones are blank", () => {
    const env = { KV_REST_API_URL: "", KV_REST_API_TOKEN: "", STORAGE_KV_REST_API_URL: "https://x.upstash.io", STORAGE_KV_REST_API_TOKEN: "tok" };
    expect(redisCredentials(env)).toEqual({ url: "https://x.upstash.io", token: "tok" });
  });

  it("prefers the plain names when they are set", () => {
    const env = { KV_REST_API_URL: "https://a", KV_REST_API_TOKEN: "a", STORAGE_KV_REST_API_URL: "https://b", STORAGE_KV_REST_API_TOKEN: "b" };
    expect(redisCredentials(env)).toEqual({ url: "https://a", token: "a" });
  });

  it("returns null when either half is missing", () => {
    expect(redisCredentials({ KV_REST_API_URL: "https://a" })).toBeNull();
    expect(redisCredentials({})).toBeNull();
  });
});

describe("authConfigProblems", () => {
  it("names each blank variable", () => {
    expect(authConfigProblems({ SETUP_PIN: "", SESSION_SECRET: " " })).toEqual([
      "SETUP_PIN is missing or blank",
      "SESSION_SECRET is missing or blank",
    ]);
  });

  it("reports a short secret with its length", () => {
    expect(authConfigProblems({ SETUP_PIN: "1234", SESSION_SECRET: "short" })).toEqual([
      "SESSION_SECRET is 5 characters; it needs at least 32",
    ]);
  });

  it("is happy with a PIN and a long secret", () => {
    expect(authConfigProblems({ SETUP_PIN: "1234", SESSION_SECRET: "x".repeat(32) })).toEqual([]);
  });
});
