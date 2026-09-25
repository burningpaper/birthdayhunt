import { describe, expect, it } from "vitest";
import { formatDuration, mightNotPlayOnIpad, pickRecordingMime, recordingExtension } from "./recording";

describe("pickRecordingMime", () => {
  it("prefers MP4 when the browser supports it (Safari, recent Chrome)", () => {
    expect(pickRecordingMime((m) => m.startsWith("audio/mp4") || m.startsWith("audio/webm"))).toBe("audio/mp4");
  });

  it("falls back to WebM Opus", () => {
    expect(pickRecordingMime((m) => m.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
  });

  it("returns undefined when nothing is supported, letting the browser choose", () => {
    expect(pickRecordingMime(() => false)).toBeUndefined();
  });
});

describe("recordingExtension", () => {
  it("maps recorder types to upload extensions", () => {
    expect(recordingExtension("audio/mp4")).toBe("m4a");
    expect(recordingExtension("audio/mp4;codecs=mp4a.40.2")).toBe("m4a");
    expect(recordingExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(recordingExtension("audio/ogg;codecs=opus")).toBe("ogg");
    expect(recordingExtension("")).toBe("m4a");
  });
});

describe("mightNotPlayOnIpad", () => {
  it("flags WebM and Ogg but not MP4", () => {
    expect(mightNotPlayOnIpad("audio/webm;codecs=opus")).toBe(true);
    expect(mightNotPlayOnIpad("audio/ogg")).toBe(true);
    expect(mightNotPlayOnIpad("audio/mp4")).toBe(false);
  });
});

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(7.9)).toBe("0:07");
    expect(formatDuration(65)).toBe("1:05");
  });
});
