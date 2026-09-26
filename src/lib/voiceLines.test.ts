import { describe, expect, it } from "vitest";
import { duplicateHunt, newHunt } from "./huntFactory";
import { resolvePlayState, toPlayResponse } from "./playState";
import { PUZZLE_TYPES, HuntSchema, emptyProgress, type Hunt } from "./schema";
import { VOICE_LINES, VOICE_LINE_IDS, recordedLines } from "./voiceLines";

function liveHunt(voiceLines?: Hunt["voiceLines"]): Hunt {
  const hunt = newHunt("Birthday");
  hunt.status = "active";
  hunt.voiceLines = voiceLines;
  return hunt;
}

function firstScan(hunt: Hunt, index = 0) {
  const station = hunt.stations[index];
  return toPlayResponse(hunt, resolvePlayState({ hunt, progress: emptyProgress(hunt.id), stationId: station.id, key: station.key, preview: false }));
}

describe("voice lines", () => {
  it("cover every puzzle's instruction, each line once", () => {
    for (const type of PUZZLE_TYPES) expect(VOICE_LINE_IDS).toContain(`instruction.${type}`);
    expect(VOICE_LINES.map((l) => l.id)).toEqual([...VOICE_LINE_IDS]);
  });

  it("are stored on a hunt, and old hunts without any still load", () => {
    const hunt = liveHunt({ "celebrate.station": "/api/media/abcdef0123456789.mp3" });
    expect(HuntSchema.parse(hunt).voiceLines).toEqual({ "celebrate.station": "/api/media/abcdef0123456789.mp3" });
    const old: Partial<Hunt> = liveHunt();
    delete old.voiceLines;
    expect(HuntSchema.safeParse(old).success).toBe(true);
  });

  it("refuse a line the app doesn't have", () => {
    const hunt = liveHunt({ "celebrate.station": "/a.mp3" });
    (hunt.voiceLines as Record<string, string>)["made.up"] = "/b.mp3";
    expect(HuntSchema.safeParse(hunt).success).toBe(false);
  });

  it("reach the child's iPad with the station, and on the Not yet screen", () => {
    const lines = { "instruction.jigsaw": "/i.m4a", "notYet.anotherClue": "/n.m4a" };
    const hunt = liveHunt(lines);
    expect(firstScan(hunt)).toMatchObject({ state: "play", voice: lines });
    expect(firstScan(hunt, 2)).toMatchObject({ state: "notYet", voice: lines });
  });

  it("are left out entirely when the hunt has none, so nothing is said", () => {
    const sent = JSON.parse(JSON.stringify(firstScan(liveHunt()))); // as the iPad receives it
    expect(sent).not.toHaveProperty("voice");
    expect(recordedLines({ "clue.find": "" })).toBeUndefined();
  });

  it("carry over when a hunt is duplicated", () => {
    const hunt = liveHunt({ "clue.find": "/go.m4a" });
    expect(duplicateHunt(hunt).voiceLines).toEqual({ "clue.find": "/go.m4a" });
  });
});
