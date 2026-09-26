# Implementation Plan — Treasure Hunt

Birthday is under two weeks away. A playable hunt comes first; physics puzzles are stretch goals.
Stack: Next.js 16 (App Router, TS strict) · Tailwind v4 · Upstash Redis · Vercel Blob · zod · nanoid · qrcode · canvas-confetti · Vitest · Playwright (WebKit, iPad landscape). Package manager: npm.

## Stage 1: Skeleton — playable end to end
Goal: Project scaffold, PIN login (HMAC-signed cookie, rate-limited), hunt CRUD, station editor (photo upload + text), play route with order enforcement (`lib/playState.ts`), placeholder "Tap to solve" puzzle, clue reveal, finale, A4 QR print page. Deployed to Vercel.
Success Criteria: A 6-station hunt printed and scanned with the iPad Camera app plays through end to end; out-of-order scans leak no future clue; reload keeps progress; `playState` unit-tested; happy-path E2E passes.
Status: Complete and deployed (https://birthdayhunt-phi.vercel.app). Remaining: scan a printed code on the real iPad.

## Stage 2: Audio
Goal: "Tap to start" audio unlock, MediaRecorder voice clues (audio/mp4 on Safari), auto-play + replay on reveal, `speak()` with en-GB/en-ZA voices, SFX.
Success Criteria: Clue recorded on the iPad is heard after scanning the next QR in Safari.
Status: Complete locally (recorder E2E-tested in WebKit). Remaining: record a clue on the real iPad against production and hear it after a scan.

## Stage 3: Core puzzles
Goal: Jigsaw → Memory Match → Counting Lock → Train Track, plus preview/test mode, difficulty presets and the hint system.
Success Criteria: Each puzzle takes 2–5 minutes at Medium on the iPad; presets visibly change each; preview never writes progress; generators and presets unit-tested.
Status: Complete and deployed. All four puzzles, hints and stars are E2E-tested in WebKit. Remaining: timing each puzzle with the real player on the iPad (the 2–5 minute target).

## Stage 4: Polish
Goal: Celebrations and stars, portrait screen, touch/zoom lockdown, "Not yet" screen, duplicate hunt, regenerate keys, validation checklist, live progress view.
Success Criteria: Spec §10 acceptance criteria met for the four core puzzles.
Status: Mostly done, much of it landed early: stars, portrait screen, pinch/zoom/callout lockdown, "Not yet" screen, duplicate, re-key, go-live checklist (now also blocks unbuilt puzzles), live progress. Remaining: fixes from the parent's real-iPad test.

## Stage 5: Dress rehearsal
Goal: Build the real hunt, print it, play it at home on the iPad.
Success Criteria: A full run with no adult help needed for the app itself; all issues found are fixed.
Status: Not Started

## Stretch: Flick Golf, then Marble Run
Goal: Matter.js puzzles; Marble Run levels as data.
Success Criteria: Each solvable in under 5 minutes at Medium; only started after Stage 5 passes.
Status: Complete and deployed. Flick Golf (5 holes, each proven sinkable) and Marble Run (5 levels, each proven solvable, plus the free-build extra). Every puzzle in the spec is built.

---

# Marble Run 3D rebuild

The first Marble Run worked but looked like "a bunch of lines and a tiny blue dot". Pieces left gaps, and after a miss the marble froze where it stopped instead of going back to the start. It's hidden from setup (`offered: false`) until this is done; stations already using it still work.

**The new approach.** The board is a grid of cells. Every piece fills one cell and has fixed openings at the middle of its edges (left, right, top, bottom). Pieces meet exactly by construction, so there are never gaps. The marble no longer bounces around a physics engine: it rolls *along* the track, and its speed comes from gravity (drops speed it up, flats and climbs slow it down). At an open end, or at a join that doesn't match, it flies off in a real arc, bounces and rolls away. Then a fresh marble drops into the start tube. The simulation is pure TypeScript, so it's deterministic, fast and easy to test.

**The look.** Three.js via React Three Fiber, loaded only on Marble Run stations. A wooden pegboard stands upright, seen at a slight angle. The tracks are fat, glossy, candy-coloured half-pipes. The marble is big and shiny, with a real shadow on the board. The start is a clear tube; the goal is a bucket with a flag. The lighting is all generated in code, with no downloaded textures (the viewer can't fetch files from other sites anyway). Pieces: straight, drop, quarter-curve (tap to turn) and a loop-the-loop that only works with enough speed.

## Stage M1: Look prototype
Goal: A static 3D render of one level on the iPad viewport: board, fixed pieces, a placed piece, marble, cup, tray.
Success Criteria: Screenshot sent to the parent and approved before any mechanics are built; steady 60fps in WebKit at 1194×834.
Status: Complete. Approved by the parent ("I love the look"). Renders at 60fps in WebKit.

## Stage M2: Track engine (pure TS, unit-tested)
Goal: Grid, ports, piece paths, rotation; the marble-on-track simulation (gravity speed, rolling friction, loop speed check), fly-off arc and bounce, cup detection.
Success Criteria: Tests cover snug joins, a mismatched join causing a fly-off, a marble too slow to climb rolling back, the same build always giving the same result.
Status: Complete (`marble3d/engine.ts`, 8 tests). The loop fits inside its own cell (the track dips into it), so it can go anywhere.

## Stage M3: Five levels + sandbox data
Goal: Levels as data (fixed cells, open build cells, tray), designed with a search tool.
Success Criteria: Each level's solution lands in the cup; an empty board misses; random builds rarely win; a test holds every level to this.
Status: Complete. Five levels; at most 2 of every possible build win (Level 5: 2 of 16,476).

## Stage M4: Play
Goal: Drag from tray to a cell (piece lifted above the finger, cell glows with a snapped 3D preview), tap to turn, drag back to remove, GO, animated run, miss → fly off, bounce, "Whoops", new marble in the tube; solve → celebration; hint ghost; sounds.
Success Criteria: E2E in WebKit solves levels 1, 3 and 5 by dragging; a miss keeps the pieces and restarts the marble at the tube; works on the real iPad.
Status: Complete in WebKit (6 marble E2E tests). Remaining: the parent's real-iPad test.

## Stage M5: Ship
Goal: Free-build extra on the new engine, `offered: true`, docs (DESIGN.md, DEVELOPER_LOGS.md), full gate, deploy.
Success Criteria: Unit + E2E suites pass; production deploy verified; parent re-tests on the iPad.
Status: Complete and deployed. Remaining: the parent re-tests on the iPad.
