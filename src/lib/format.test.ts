import { describe, expect, it } from "vitest";
import { formatDay } from "./format";

describe("formatDay", () => {
  it("formats the same everywhere, independent of locale data", () => {
    expect(formatDay("2026-09-25T14:13:18.887Z")).toBe("25 Sep 2026");
    expect(formatDay("2027-01-03T00:00:00.000Z")).toBe("3 Jan 2027");
  });
});
