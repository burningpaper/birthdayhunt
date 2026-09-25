import { describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, createSessionToken, isValidSessionToken, pinMatches } from "./session";

const SECRET = "a".repeat(32);

describe("session tokens", () => {
  it("accepts a fresh token", () => {
    expect(isValidSessionToken(createSessionToken(SECRET), SECRET)).toBe(true);
  });

  it("rejects an expired token", () => {
    const issued = Date.now() - SESSION_TTL_SECONDS * 1000 - 1;
    expect(isValidSessionToken(createSessionToken(SECRET, issued), SECRET)).toBe(false);
  });

  it("rejects a token signed with another secret", () => {
    expect(isValidSessionToken(createSessionToken("b".repeat(32)), SECRET)).toBe(false);
  });

  it("rejects a token whose expiry was edited", () => {
    const [, signature] = createSessionToken(SECRET).split(".");
    expect(isValidSessionToken(`99999999999999.${signature}`, SECRET)).toBe(false);
  });

  it("rejects missing and malformed tokens", () => {
    for (const token of [undefined, "", "nodot", ".", "123."]) {
      expect(isValidSessionToken(token, SECRET)).toBe(false);
    }
  });
});

describe("pinMatches", () => {
  it("matches only the exact PIN", () => {
    expect(pinMatches("4821", "4821", SECRET)).toBe(true);
    expect(pinMatches("4822", "4821", SECRET)).toBe(false);
    expect(pinMatches("48210", "4821", SECRET)).toBe(false);
    expect(pinMatches("", "4821", SECRET)).toBe(false);
  });
});
