import { describe, expect, it } from "vitest";
import { normalizeOrigin } from "./origin";

describe("normalizeOrigin", () => {
  it("adds https:// to a bare host, so QR codes are links not search text", () => {
    expect(normalizeOrigin("birthdayhunt-phi.vercel.app")).toBe("https://birthdayhunt-phi.vercel.app");
  });

  it("keeps a full origin and trims slashes, paths and spaces", () => {
    expect(normalizeOrigin("https://birthdayhunt-phi.vercel.app/")).toBe("https://birthdayhunt-phi.vercel.app");
    expect(normalizeOrigin("  https://our-hunt.example.com/setup  ")).toBe("https://our-hunt.example.com");
    expect(normalizeOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("returns null for blank or unusable values", () => {
    for (const value of [undefined, "", "   ", "not a url", "ftp://files.example.com", "javascript:alert(1)"]) {
      expect(normalizeOrigin(value), String(value)).toBeNull();
    }
  });
});
