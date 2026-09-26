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

## 2026-09-25 — Four real puzzles

All four core puzzles are built in one push. Each follows the same shape: pure logic with its own tests, a component on the shared `PuzzleProps` contract, a screenshot pass in WebKit, and an E2E solver that plays it through the real UI the way a child would. A shared stage wraps them all, with the hint button (it glows after 5 misses or 2 idle minutes) and 1 to 3 stars on the celebration.

**Jigsaw** needed the most care, and taught three lessons worth keeping. First, a CSS `transform-box: fill-box` on an SVG group includes the *whole unclipped photo*, so rotated pieces swung off-screen. They now rotate about their own cell centre. Second, loose pieces need room: the board now shrinks until they fit beside it with at most about 20% overlap, and a test enforces that for every piece count and photo shape. Third, and nastiest: raising a touched piece to the top moves its DOM node, and moving a node silently drops pointer capture. A fast finger then released over a *different* piece, and the drop was committed to the wrong one. Drags now live on the board, and the dragged piece is always looked up by id.

**Memory Match** first used the classic 3D card with `backface-visibility`. WebKit rendered every card face-up and mirrored. A flip is now two half-turns, the old face out edge-on and the new face in, so only one face ever exists.

**Counting Lock** gives a single 0 to 99 dial two wheels, tens and ones, because nobody should tap "up" 47 times. The hint gives a direction without the answer: "Dial 2 is more than 1!"

**Train Track** generates a winding route, fills the rest with decoys, and spins everything. Tests generate 180 boards and prove each is solvable twice: along its planted route, and by an independent depth-first solver. The E2E suite uses that same solver to play boards. The train ride is capped at 4 seconds, because a winding 6×6 route made it long enough to lose a seven-year-old's patience (and time out a test).

Marble Run and Flick Golf remain stretch goals. They're marked "coming soon" in the editor, new hunts default to the four finished puzzles, and a hunt can't go live while a station uses an unbuilt one.

## 2026-09-26 — The case of the vanishing photos

The first real use ended badly: a parent added clue photos and puzzle details, went back to the editor, and found everything gone. The production logs cleared the obvious suspect straight away, because every save had returned 200. What they did show was the editor's 10-second progress poll firing every 5 seconds, which meant two copies of the editor were open on the same hunt.

Two reproductions confirmed two routes to the same loss. The browser's Back button restored a cached editor showing the hunt as it was on first load, while the server still held everything. And a second, older editor saved its whole stale hunt over the newer one. The root cause was the save model: the whole hunt went up each time, last write won, and nothing checked whether the writer had seen the latest version.

The fix is optimistic concurrency. Each hunt carries a `revision`, and each save names the revision it was based on. The server refuses anything older with a 409 and keeps what it has. The editor now syncs whenever it opens (including via Back), when the tab regains focus, and every 10 seconds. It quietly takes the newer copy when nothing local is unsaved, and otherwise stops and says "This hunt was changed somewhere else". The regression tests were checked the honest way: all three fail on the old code and pass on the new. (The first attempt at that check "failed" only because the old code wouldn't build with the new files still present. Stash the untracked files too.)

The uploaded photo files themselves are still in Blob storage, but the overwritten hunt no longer points at them, so they had to be re-added.
