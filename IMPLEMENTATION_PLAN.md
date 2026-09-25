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
Goal: Matter.js puzzles; Marble Run levels as JSON.
Success Criteria: Each solvable in under 5 minutes at Medium; only started after Stage 5 passes.
Status: Not Started
