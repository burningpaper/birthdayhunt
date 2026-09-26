import { describe, expect, it } from "vitest";
import { newHunt } from "./huntFactory";
import { currentLiveHunt } from "./liveHunt";
import type { Hunt } from "./schema";

function hunt(title: string, status: Hunt["status"], createdAt: string, activatedAt?: string): Hunt {
  return { ...newHunt(title, new Date(createdAt)), status, activatedAt };
}

describe("currentLiveHunt", () => {
  it("is nothing when no hunt is live", () => {
    expect(currentLiveHunt([hunt("Draft", "draft", "2026-09-01T00:00:00Z")])).toBeNull();
    expect(currentLiveHunt([])).toBeNull();
  });

  it("is the live hunt that went live most recently, not the newest one made", () => {
    const older = hunt("Made first, live last", "active", "2026-09-01T00:00:00Z", "2026-09-20T00:00:00Z");
    const newer = hunt("Made last, live first", "active", "2026-09-10T00:00:00Z", "2026-09-11T00:00:00Z");
    const draft = hunt("Newest draft", "draft", "2026-09-25T00:00:00Z");
    expect(currentLiveHunt([newer, draft, older])?.title).toBe("Made first, live last");
  });

  it("falls back to when a hunt was made, for ones live before the time was kept", () => {
    const a = hunt("A", "active", "2026-09-01T00:00:00Z");
    const b = hunt("B", "active", "2026-09-05T00:00:00Z");
    expect(currentLiveHunt([a, b])?.title).toBe("B");
  });
});
