import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { decodeFrame, treasurePathFrom } from "./scan";

/** Draw a QR code into RGBA pixels, as a camera frame would deliver them. */
function renderQr(text: string, scale = 6): { data: Uint8ClampedArray; width: number; height: number } {
  const modules = QRCode.create(text, { errorCorrectionLevel: "M" }).modules;
  const quiet = 4;
  const size = (modules.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

describe("treasurePathFrom", () => {
  it("turns a printed station URL into a path on this site", () => {
    expect(treasurePathFrom("https://birthdayhunt-phi.vercel.app/h/sams-hunt-ab12/s/sq3xk9p?k=aqsznj")).toBe("/h/sams-hunt-ab12/s/sq3xk9p?k=aqsznj");
  });

  it("works whichever host the code was printed from", () => {
    expect(treasurePathFrom("http://192.168.1.20:3000/h/sams-hunt-ab12/s/s1?k=aqsznj")).toBe("/h/sams-hunt-ab12/s/s1?k=aqsznj");
  });

  it("reads codes printed without https:// (before the QR fix)", () => {
    expect(treasurePathFrom("birthdayhunt-phi.vercel.app/h/birthday-treasure-hunt-nzum/s/spj64jr?k=ggsw96")).toBe(
      "/h/birthday-treasure-hunt-nzum/s/spj64jr?k=ggsw96",
    );
  });

  it("drops anything extra in the URL, like a preview flag", () => {
    expect(treasurePathFrom("https://x.app/h/sams-hunt-ab12/s/s1?k=aqsznj&preview=1")).toBe("/h/sams-hunt-ab12/s/s1?k=aqsznj");
  });

  it("refuses anything that isn't one of our treasure codes", () => {
    for (const text of [
      "hello",
      "https://example.com/",
      "https://x.app/h/sams-hunt-ab12/s/s1", // no key
      "https://x.app/h/sams-hunt-ab12/s/s1?k=short",
      "https://x.app/setup",
      "javascript:alert(1)",
      "https://x.app/h/../setup/s/s1?k=aqsznj",
    ]) {
      expect(treasurePathFrom(text), text).toBeNull();
    }
  });
});

describe("decodeFrame", () => {
  it("reads a treasure code from camera-like pixels", () => {
    const url = "https://birthdayhunt-phi.vercel.app/h/sams-hunt-ab12/s/sq3xk9p?k=aqsznj";
    const frame = renderQr(url);
    expect(decodeFrame(frame.data, frame.width, frame.height)).toBe(url);
  });

  it("returns null when there's no code in view", () => {
    const blank = new Uint8ClampedArray(200 * 200 * 4).fill(200);
    expect(decodeFrame(blank, 200, 200)).toBeNull();
  });
});
