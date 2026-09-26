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

## 2026-09-26 — Scanning without leaving the page

Two scanning problems surfaced on the first real run. First, iOS gives a web page no way to open the Camera app, so a "scan a code" homepage with nothing to tap was a dead end. Second, printed codes made the Camera app offer a *web search*. `NEXT_PUBLIC_SITE_URL` had been set to a bare host, and the QR codes used it verbatim, so they held text, not a URL. That value is now normalised (`lib/origin.ts`), and that fix shipped on its own first because it was blocking play.

The bigger change is an in-page scanner. A "Scan a code!" button opens the camera over the page and decodes frames with jsQR (Safari has no BarcodeDetector), downscaled to 720px about 8 times a second. It only navigates to a station path on this site, so a stray QR code can't send a child anywhere else. It also reads the old scheme-less codes, so anything already printed still works. It's on the homepage, on the clue screen ("Scan the next code"), and on the not-yet and invalid screens, so a whole hunt runs in one tab. It's portalled to `<body>`, because a `position: fixed` overlay inside the clue screen's animated container would otherwise be trapped.

Testing it honestly took one wrong turn. The E2E tests fake a camera with `canvas.captureStream()` showing a real QR code. WebKit silently ignores assigning over `navigator.mediaDevices.getUserMedia`, so the real, denied camera was used instead, and the "blocked camera" test passed by coincidence. Overriding `MediaDevices.prototype.getUserMedia` works, and a debug pass confirmed frames were really flowing before trusting the green run.

## 2026-09-26 — The mystery close-up, and a print run that told the truth

The first real jigsaw had a flaw only play could reveal: halfway through, you know what the picture is, and the rest is busywork. The fix keeps "the photo is the puzzle" but hides it. The parent drags a box onto a detail of the clue photo (the box keeps the photo's shape), and the jigsaw is cut from just that close-up. When the last piece lands, the whole photo is drawn at board size, starts blown up so only the close-up shows (identical to the finished pieces), and animates back to full size. The first easing front-loaded the motion, so it read as a snap. A slow-in, slow-out curve over 2.2 seconds reads as a pull-back. The geometry lives in `puzzles/jigsaw/crop.ts` with its own tests. The close-up survives difficulty changes, resets when the photo changes, and is dropped on duplicate.

Printing interrupted, and got the same treatment as every bug: evidence first. Rendering the sheet to a real A4 PDF (headless Chromium, then PDFKit to turn the pages into images) showed exactly why codes were cut. The cards were grid items, which browsers won't reliably keep whole across pages. The editor's padding still printed, pushing page 1's second code onto page 2. And the plastic badges' blurred shadows printed as grey boxes. Codes now go in explicit A4 sheets of 2 or 4, each one printable page tall with a forced break after it.

Along the way the growing E2E suite locked itself out: the login limit counted correct PINs too. Now only wrong ones count, and the lock is still checked before the PIN.

## 2026-09-26 — Flick Golf, and a reset you can find

Flick Golf is the first physics puzzle, built on Matter.js at a fixed 60 ticks a second, so a given shot always plays out the same way. That determinism is what made it testable. Rather than hand-tune each hole's "known good" shot, a scratch search fired about 5,000 shots per hole through the real engine and kept the most forgiving one: the shot with the most sinking neighbours. The counts also turned out to be the course's difficulty curve, 859 sinking shots on the warm-up falling to 141 on the moving bridge. Unit tests replay the stored shots to prove every hole can be sunk, and the E2E suite plays them as real drags. Two self-inflicted bugs came up on the way. `holesFor()` built a new array every render, which would have rebuilt the physics world after each shot, so it's now memoised. And the "at rest" flag carried over from the previous hole's shot.

The parent also asked for a way to set every puzzle back to unsolved before the real day. One existed, but it was tucked in the editor's Progress panel and greyed out until something was solved. Each hunt on the list now has a Reset button next to its "found" count, with a plain confirmation: "Set every puzzle back to unsolved?"

## 2026-09-26 — Marble Run, the last puzzle

Marble Run was designed the same way golf was tested: by simulation, not guesswork. A scratch preview draws each level with the marble's *real* simulated path traced on top, for no pieces and for the intended build. A search tries every way to place the tray's pieces into the zones. That loop caught problem after problem that would otherwise have reached the iPad. Slopes were too gentle, so the marble stopped dead on a flat ramp. A ramp's exit sat below the next slope, so the marble shot underneath it. The cup sat a marble-width too far right. The intended "turn around" route didn't win at all, while a shortcut did. The finished levels climb from 1 zone and 2 pieces (1 of 12 builds works) to 4 zones, 6 pieces, two decoys and a moving bar. Tests prove the bar is what defeats an otherwise working funnel build on level 5, so the obstacle actually matters.

Shortcuts were left in where they exist. A seven-year-old finding their own route through a marble run is the point, not a bug. The hint always teaches the intended build.

Build zones are real buttons laid over the canvas, which makes them accessible and trivially tappable, and which let the E2E solver drag pieces exactly as a child would. The free-build extra reuses the same component with two of every piece and a cheer instead of a win. It opens from "Keep building!" on the clue screen, so it never holds up the hunt. With every puzzle built, new hunts use the spec's exact default order again, and the "Tap to solve" placeholder is gone.

## 2026-09-26 — Marble Run, rebuilt in 3D

The parent's verdict on the first Marble Run was fair: "a bunch of lines and a tiny blue dot". Pieces left visible gaps, and after a miss the marble seemed to restart from wherever it had stopped. A round of tidying the 2D levels (pegboard styling, grid-snapped slopes, a layout linter) made it neater, but it couldn't fix the real problems. Free-floating sticks under a physics engine will always leave gaps and awkward stalls. That work is kept in a git stash, and the puzzle was rethought from scratch.

While it was rebuilt, setup stopped offering it. A new `offered` flag hid it from the picker and from new hunts, separately from `ready`, so a live hunt that already used it could still be saved.

**Snap, don't float.** The board is now a grid, and every piece fills one cell and opens onto the middle of its edges. Neighbouring pieces meet at exactly the same point, so a gap is impossible by construction. There are three pieces: straight, quarter-curve and a loop-the-loop. The first loop poked into the cell above, so the track now dips to the loop's foot and climbs back out, and the whole thing fits in its own square.

**Roll, don't bounce.** There's no physics engine any more. At GO, `marble3d/engine.ts` works out the whole journey. The marble rolls along the pieces' centre lines, gravity speeds it up downhill, rolling friction and bends slow it a little, and if it can't climb any further it rolls back. At an opening with nothing that fits on the other side, it flies off in a real arc, pops slightly towards the player, and bounces on the table. The 3D view just plays the frames back. Every run starts from the tube, so a miss can't leave the marble stranded. Being deterministic, the engine lets the tests prove each level: its solution lands in the bucket, an empty board misses, and at most 2 of every possible build win (2 of 16,476 on Level 5).

**Make it look like a toy.** The look was prototyped as a still frame first and approved before any mechanics were built. A wooden pegboard with painted grain and peg holes, clear tubes with cream collars, a big red marble, real shadows, and reflections from a studio of glowing panels, all generated in code with nothing downloaded. It holds 60fps in WebKit at iPad size.

Interaction kept everything the 2D version learned the hard way on iOS: pointer capture on a box that never moves, the dragged piece floating 70px above the finger, and the tray spot kept (faded) during a drag. New are a see-through 3D preview snapped into the glowing square, and HTML buttons laid over each square using the camera's projection, which keeps taps accessible and lets the E2E solver drag exactly as a child would. Free build is now a bare board with endless pieces.

## 2026-09-26 — Marble Run: from fill-in-the-blanks to find-the-route

The parent loved the 3D Marble Run, then said the thing that mattered: "WAAAAAAY too easy". They were right, and the tests had hidden it. "At most 2 of every possible build win" sounds hard. But every open square had exactly one sensible piece, and the fixed pipes had already drawn the route. It was a colouring book.

Asked what kind of hard they wanted, the parent picked "find the route", at about five minutes for Medium. So now the whole board is buildable. The only things on it are the tube, the bucket and a few chunky plastic blocks (with studs, like a toy brick) that the run has to go round. The tray is grouped by type with a count ("×5"), holding just the pieces the route needs plus a spare or two. With 9 curves and 3 straights, you can't just lay pipes towards the bucket; you have to plan where the turns go.

The levels were designed by a generator, not by hand. It walks a random downhill route from the tube to the bucket and fills the tray with exactly that route's pieces (plus spares). It then asks the new route solver (`marble3d/routes.ts`) for every winning path, and drops a block on the square the alternatives use most, until only one or two remain. Candidates were printed as ASCII sketches and chosen by eye. The sketches live in `levels.ts` above each level. The five climb from a 6-piece warm-up to a 13-piece run on a 7 × 4 board with a loop.

The solver follows the marble instead of trying every way to fill the board, which would be astronomically many ways now that every square is open. From the tube, at each empty square it tries each tray piece that opens onto the side the marble arrives from, then carries on out of its other end. Each candidate is rolled through the real engine, so a route the marble hasn't the speed for doesn't count. One subtlety: a loop and a flat straight join the same two sides, so "loop here or loop there" isn't a different path. `distinctPaths` counts them once.

The same solver makes the hint smarter. It no longer insists on the stored solution. It finds the winning route that shares the most with what the child has already built and shows that route's next missing piece, so a child on a valid alternative isn't steered off it.
