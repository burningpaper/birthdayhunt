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

## 2026-09-25 — First deploy, and the parent's voice

The first production deploy failed in an instructive way. Every variable existed in Vercel, but three of them were blank: `.env.example` had been imported as-is. Upstash, finding the plain `KV_*` names taken, filed its real credentials under a `STORAGE_` prefix. The old code read the blank `KV_*` values, because `??` passes empty strings straight through. Now all config goes through `env.ts`: a blank value counts as missing, several names are tried in order, and the auth error names the exact variable that's wrong. We removed the blank placeholders, created a public Blob store (`birthdayhunt-media`) with the Vercel CLI, and redeployed. Diagnosis was harder than it should have been because Sensitive variables read back as the literal `[sensitive]`. Runtime logs were the only honest witness.

Stage 2 is the parent's voice. `VoiceRecorder` wraps MediaRecorder with record, stop, upload, play back and re-record. It prefers `audio/mp4`, because the clip plays on the child's iPad in Safari. If a desktop browser can only make WebM, the parent gets a gentle "record it on the iPad to be safe". Clue recordings get a plastic button, because they matter. Lock-question recordings get a quiet one: plastic is reserved for the main action, and three red buttons in a row was shouting. Speech synthesis now warms up its voice list when the module loads, because browsers fill it asynchronously and the first line otherwise came out in the default accent.

Two testing lessons. Next 16 allows only one `next dev` per project, so the E2E suite now runs against `next build && next start`, which is closer to Vercel anyway. That exposed the login cookie's `Secure` flag being tied to `NODE_ENV` rather than the actual protocol. It now follows `x-forwarded-proto`.

A postscript on the recorder. Right after Stage 2 landed, its E2E test turned flaky with "Nothing was recorded". The first fix was sound but didn't cure it: the mic tracks were being stopped before the recorder flushed, so now they're released inside `onstop`. Logging each recorder event settled the rest. WebKit's MP4 recorder ignores the timeslice and delivers one chunk at stop, and under load the AAC encoder sometimes hadn't produced anything 1.5 seconds in. A real parent speaks for several seconds, so the test now records for 3. If a clip ever does come out empty, the message now tells the parent to speak for a few seconds. Full suite: 3 runs out of 3 green. Also, test gates now check exit codes: a `grep` in the command chain let the flaky suite through to one commit.
