# Developer Logs

## 2026-09-25 — Before the first line of code

The repo held one file: a spec for a treasure hunt that a seven-year-old would play on an iPad, scanning QR codes hidden around the house. The birthday is less than two weeks away, and that deadline shaped every decision.

The spec already named its stack, and it's a sound one, so we kept it. Next.js on Vercel, Upstash Redis for state, Vercel Blob for photos and voice clips. The key constraint is subtle: QR scans on iOS always open in Safari, never in a home-screen app, so progress can't live in the browser. It lives on the server.

We added four small things. **zod** gives the data model a single source of truth, so the same schema checks API input and powers the parent's "ready to go live?" checklist. **nanoid** makes the station keys. **canvas-confetti** saves writing a particle system by hand. **Vitest and Playwright** (using WebKit, the engine closest to iPad Safari) are the safety net.

The biggest call was the order of work. The two physics puzzles, Flick Golf and Marble Run, are the most fun and also the riskiest, so they come last as stretch goals. That's safe because the spec lets any puzzle go at any station. If the physics games aren't ready, the hunt still runs on six stations built from the other four puzzle types. The plan also ends with a dress rehearsal day, because the real test is a printed QR code taped under a couch cushion.

npm is the package manager, since pnpm isn't installed on this machine.
