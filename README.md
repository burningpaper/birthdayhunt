# Treasure Hunt

A QR-code treasure hunt for the house. A grown-up hides printed codes. A kid finds one, scans it with the iPad camera, solves a touch puzzle, and gets a photo (and the grown-up's voice) pointing at the next hiding spot. The last clue leads to the treasure.

The full brief lives in [spec.md](spec.md). The visual language, Toybox Plastic, is explained in [DESIGN.md](DESIGN.md), and you can see it live at `/styleguide`.

## Run it on your machine

```bash
npm install
cp .env.example .env.local   # then set SETUP_PIN and SESSION_SECRET
npm run dev
```

Open http://localhost:3000/setup and sign in with your PIN.

You don't need any cloud accounts locally. Without Redis credentials the app keeps hunts in `.data/db.json`, and without a Blob token it stores photos in `.data/uploads/`. Both folders are gitignored.

To try it on the real iPad before deploying, run `npm run dev -- -H 0.0.0.0` and open `http://<your-mac's-ip>:3000/setup` on the iPad (same Wi-Fi). Printed QR codes point at whatever address you used, so print the real ones from the deployed site.

## Deploy (GitHub → Vercel)

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo. The defaults are fine.
3. In the project's **Storage** tab:
   - Connect **Upstash for Redis** (from the Marketplace). This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
   - Create a **Blob** store with **public** access. This sets `BLOB_READ_WRITE_TOKEN`.
4. In **Settings → Environment Variables**, add:
   - `SETUP_PIN`: the parent PIN.
   - `SESSION_SECRET`: 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).
   - `NEXT_PUBLIC_SITE_URL` (recommended): your production URL, for example `https://our-hunt.vercel.app`. QR codes printed from a preview deploy then still point at production.
5. Redeploy so the new variables take effect.

The deployed app refuses to run without Redis instead of quietly falling back to a disk that Vercel throws away. That protects a kid's progress on the day.

## Checks

| Command | What it proves |
|---|---|
| `npm test` | Unit tests: order enforcement, clue-leak rules, presets, sessions, storage |
| `npm run e2e` | Playwright in WebKit at iPad landscape: a parent builds a hunt, a child plays it end to end |
| `npm run typecheck` | TypeScript, including Next's generated route types |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

## How it fits together

A scan opens `/h/{hunt}/s/{station}?k={key}`. The server loads the hunt and the child's progress, and one pure function (`resolvePlayState` in [src/lib/playState.ts](src/lib/playState.ts)) decides whether this scan is **play**, **solved**, **not yet** or **invalid**. A second function, `toPlayResponse`, decides what may leave the server. Clues are only included once they're earned, so a curious kid with dev tools finds nothing. The jigsaw photo is the one exception, because the photo is the puzzle.

Everything else is plumbing around that decision:

- [src/lib/schema.ts](src/lib/schema.ts): the data model as zod schemas, so types and validation can't drift apart.
- [src/lib/store/](src/lib/store/): Redis in production, a JSON file locally, behind one interface.
- [src/app/api/](src/app/api/): the API from spec §8.
- [src/components/play/](src/components/play/): the kid's screens. [src/puzzles/](src/puzzles/) holds one component per puzzle behind a shared `PuzzleProps` contract.
- [src/components/setup/](src/components/setup/): the parent's editor, with autosave.
- [src/lib/audio/](src/lib/audio/): the iOS audio unlock, synthesized sound effects, speech and recordings.

## Security notes

- There's one PIN and no accounts. The PIN is compared in constant time, and logins are rate-limited to 10 tries per 15 minutes per IP.
- The session cookie is an HMAC-signed expiry, httpOnly, and lasts 30 days.
- Test mode (`&preview=1`) only works with that cookie.
- Uploaded media is public but sits at unguessable URLs. Don't upload anything you wouldn't want a stranger to see.
