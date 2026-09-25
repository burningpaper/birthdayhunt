# Developer Logs

## 2026-09-25 — Before the first line of code

The repo held one file: a spec for a treasure hunt that a seven-year-old would play on an iPad, scanning QR codes hidden around the house. The birthday is less than two weeks away, and that deadline shaped every decision.

The spec already named its stack, and it's a sound one, so we kept it. Next.js on Vercel, Upstash Redis for state, Vercel Blob for photos and voice clips. The key constraint is subtle: QR scans on iOS always open in Safari, never in a home-screen app, so progress can't live in the browser. It lives on the server.

We added four small things. **zod** gives the data model a single source of truth, so the same schema checks API input and powers the parent's "ready to go live?" checklist. **nanoid** makes the station keys. **canvas-confetti** saves writing a particle system by hand. **Vitest and Playwright** (using WebKit, the engine closest to iPad Safari) are the safety net.

The biggest call was the order of work. The two physics puzzles, Flick Golf and Marble Run, are the most fun and also the riskiest, so they come last as stretch goals. That's safe because the spec lets any puzzle go at any station. If the physics games aren't ready, the hunt still runs on six stations built from the other four puzzle types. The plan also ends with a dress rehearsal day, because the real test is a printed QR code taped under a couch cushion.

npm is the package manager, since pnpm isn't installed on this machine.

## 2026-09-25 — Toybox Plastic, and a hunt you can actually play

The brief for the look was three words: colourful, shiny plastic. The trap was building something that looked like a preschool worksheet, so we aimed at toy hardware instead: Nintendo buttons, a glossy LEGO brick.

Everything visual comes from one CSS recipe, `.plastic`, driven by a single colour variable. It has a gradient body, a gloss highlight across the top, a white rim light, a solid darker "lip" underneath, and a navy-tinted cast shadow. Press it and it sinks 4px while the lip shrinks, and a synthesized "tock" plays at the same moment. The shades come from `color-mix()`, so adding a colour takes one line. Each of the six puzzles owns one plastic colour, so a station has an identity on sight. DESIGN.md has the full reasoning, and `/styleguide` renders it live.

Sound effects are synthesized with Web Audio rather than loaded from files. That means nothing to download and no latency, and the parent never has to source sound files.

The server was the other half of the session. The key decision is that one pure function decides what a scan means, and a second decides what may leave the server. Every clue-leak rule in the spec is tested against that second function, not against the UI.

For local development the app runs with no cloud accounts at all. A JSON file stands in for Redis, and a folder stands in for Blob, served with byte-range support because Safari won't play audio without it. On Vercel, the app refuses to start without Redis rather than quietly writing a kid's progress to a disk that gets thrown away.

Next 16 surprises: `middleware` is now `proxy`, and `params` and `cookies()` are async. We skipped proxy entirely and check the session in a route-group layout, which is the real check rather than a hint. Two smaller bugs are worth remembering. Node and Safari format "Sep" differently, which broke hydration, so dates are now formatted by hand. And Safari blocks `window.open` after an `await`, so "Test station" opens its tab first and then points it at the URL once the save lands.
