# Treasure Hunt — Build Spec

A web app for running QR-code treasure hunts around the house for a sharp 7-year-old who is very confident on the iPad. The parent hides printed QR codes. The child finds one, scans it with the iPad's built-in Camera app, solves a short touch game, and the game reveals a clue to the next hiding spot. The last clue leads to the treasure.

The app has two sides:
- **Play**: what the child sees. Touch-first, with spoken instructions and short, simple on-screen text.
- **Setup**: what the parent uses to build and reuse hunts (photos, voice clues, puzzle choices, printable QR sheet).

Hunts must be reusable. Birthdays keep coming, so the parent should be able to set up a new hunt in 20 minutes without touching code.

---

## 1. Users and devices

| | Child (player) | Parent (setup) |
|---|---|---|
| Age / skill | 7, bright, confident iPad gamer, reads simple sentences | Technical, but setup should need no code |
| Device | iPad, Safari, **landscape** | iPad or Mac, Safari/Chrome |
| Entry point | Scans QR with the iOS Camera app, which opens the URL in Safari | Bookmarked `/setup` URL, PIN-protected |

**Hard requirement:** all play screens must work in iPad Safari opened from a QR scan. Do not rely on a home-screen PWA install. iOS gives PWAs separate storage from Safari, and QR scans always open in Safari. This is why state lives on the server, not in the browser (see §4).

---

## 2. Tech stack

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**
- **Tailwind CSS** for styling
- **Matter.js** for physics (Marble Run, Flick Golf)
- **Vercel Blob** for uploaded media (photos, audio)
- **Upstash Redis** (via the Vercel Marketplace) for hunt config and progress, stored as JSON
- **`qrcode`** npm package to generate QR images
- Setup auth: a single parent PIN in the env var `SETUP_PIN`, checked server-side and remembered in an httpOnly cookie. There are no user accounts.

Keep dependencies minimal. There are no analytics and no third-party trackers.

---

## 3. Core flow

```
Parent: /setup → create hunt → configure 6 stations → print QR sheet → hide codes
Child:  finds QR #1 → scans → /h/{huntId}/s/{stationId}?k={key}
        → intro animation + spoken instruction
        → plays puzzle
        → success celebration
        → CLUE REVEAL: photo of next hiding spot + parent's recorded voice clue (replayable)
        → goes looking for QR #2 … repeat …
        → after the final station: TREASURE reveal (clue to the treasure location + big celebration)
```

### Clue design
Each station's reveal shows the clue **for the next location**, not for itself:
- **Clue photo** (required): a photo of the next hiding spot, often zoomed or at an odd angle
- **Voice clue** (optional but encouraged): the parent's recorded audio, auto-played on reveal with a big replay button
- **Clue text** (optional): a short written clue or riddle he reads himself (for example "I keep things cold and hum all night"). The parent chooses per station whether the text is shown large as part of the clue, or hidden.

Mixing clue styles keeps it interesting: some stations give a straight photo, some a zoomed-in mystery photo, and some a riddle with no photo at all.

The final station's clue points to the treasure.

---

## 4. Data model

Store as JSON in Redis. Media URLs point to Vercel Blob.

```ts
type Hunt = {
  id: string;              // short slug, e.g. "bday-2026"
  title: string;           // "Birthday Treasure Hunt"
  childName?: string;      // used in on-screen/spoken greetings
  createdAt: string;
  stations: Station[];     // ordered; default 6
  treasureMessage?: string;
  status: "draft" | "active";
};

type Station = {
  id: string;              // stable id, e.g. "s1"
  order: number;           // 1..N
  key: string;             // random 6-char token embedded in the QR URL
  hidingNote: string;      // parent-only: "inside the laundry basket"
  puzzle: PuzzleConfig;
  clue: {                  // clue revealed AFTER solving this station → points to the next
    photoUrl?: string;     // required unless showText is true (riddle-only clue)
    audioUrl?: string;
    text?: string;
    showText: boolean;     // show the text large on the clue screen
  };
};

// Ranges deliberately span roughly ages 6–10 so the same app scales up each birthday.
type PuzzleConfig =
  | { type: "jigsaw"; pieces: 6 | 9 | 12 | 16; rotation: boolean } // uses the clue photo; rotation = pieces start rotated, tap to turn
  | { type: "marbleRun"; level: 1 | 2 | 3 | 4 | 5 }
  | { type: "trainTrack"; gridSize: 4 | 5 | 6 }
  | { type: "memoryMatch"; pairs: 6 | 8 | 10 | 12; photoUrls?: string[] } // falls back to built-in illustrations
  | { type: "flickGolf"; holes: 1 | 2 | 3 | 4 | 5 }
  | { type: "countingLock"; digits: 1 | 2 | 3; questions: LockQuestion[] }; // one question per dial

type LockQuestion = { questionText: string; questionAudioUrl?: string; answer: number }; // 0–9 per dial, or 0–99 if digits = 1

type Progress = {
  huntId: string;
  completedStationIds: string[];
  startedAt?: string;
  finishedAt?: string;
};
```

Any puzzle type can go at any station. The default new hunt uses this order: Jigsaw → Marble Run → Train Track → Memory Match → Flick Golf → Counting Lock.

**Default difficulty (age 7, confident):** Jigsaw 12 pieces with rotation off; Marble Run level 3; Train Track 5×5; Memory Match 10 pairs; Flick Golf 3 holes; Counting Lock with 3 dials. The hunt editor has a single **difficulty preset** (Easy / Medium / Hard) that sets all of these at once. Medium is the age-7 default above; Easy and Hard shift everything one step down or up. Stations can still be tweaked individually.

---

## 5. Play side (child)

### 5.1 Routes
- `/h/{huntId}/s/{stationId}?k={key}` is the station page.
- An invalid key or unknown station shows a friendly "Hmm, that's not a treasure code!" screen.

### 5.2 Order enforcement
- If the child scans a station **ahead** of their next expected one, show a gentle screen: "Not yet! There's another clue to find first 🔍". Replay the most recent clue they earned with its photo and audio. **Do not reveal anything about the scanned station.**
- If they scan a station they've **already solved**, go straight to its clue reveal so they can re-see it.
- If they scan the **correct next** station, the puzzle plays.
- Progress is saved server-side on each solve, so reloading or re-scanning never loses progress.

### 5.3 Design rules for a 6-year-old
- **Light reading, never required.** Every puzzle has a short spoken instruction on start, with a speaker button to replay it, plus a one-line on-screen version in simple words. Use the Web Speech API (`speechSynthesis`, en-GB/en-ZA voice if available) unless a parent recording exists.
- **Game-like, not babyish.** He plays real iPad games (Trailmakers, Super Stickman Golf), so aim for the feel of a good casual game: crisp animation, satisfying sounds, no cartoon-toddler styling. Touch targets at least 48px.
- **Landscape layout.** In portrait, show a "turn me sideways" illustration.
- **No timers, no scores, and no "wrong" buzzers.** Failure should feel like play: the marble bounces off, the card flips back, and so on.
- **Hints:** after 5 failed attempts (or 2 minutes of no progress), a hint button starts glowing. Each puzzle defines its own hint (see §6). Hints are optional; he chooses whether to tap.
- **Celebration on solve:** confetti, a cheerful sound, and a big "You did it!" (spoken), then the clue reveal slides in.
- **Audio unlock:** iOS blocks autoplay. Put a big "Tap to start!" button on each station's intro screen and use that tap to unlock the audio context for the whole session.
- Disable pinch-zoom, text selection, long-press callouts and pull-to-refresh on play screens (`touch-action: none` on game canvases, `user-select: none`, and so on).
- Each puzzle should take about 2–5 minutes to solve at the default difficulty.
- **Star rating on solve (optional flourish):** 1–3 stars based on attempts and hints used, shown on the celebration screen. Stars only reward; they never block progress.

### 5.4 Clue reveal screen
- Full-bleed clue photo with a gentle zoom-in animation
- Auto-play the voice clue, with a large 🔊 replay button
- A small "Go find it!" prompt. There is no "next" button, because the next step is physical.

### 5.5 Treasure finale
After the last station, give it extra-big confetti and fanfare, show the final clue, and display `treasureMessage` if one is set. Record `finishedAt`.

---

## 6. The six puzzles

Build each puzzle as a self-contained React component with this interface:

```ts
type PuzzleProps = {
  config: PuzzleConfig;
  cluePhotoUrl: string;       // some puzzles use it
  onSolved: () => void;
  onAttemptFailed?: () => void; // drives the hint timer
};
```

### 6.1 Picture Jigsaw
- Cut the clue photo into `pieces` (6/9/12/16) pieces with proper jigsaw tab shapes.
- Scatter the pieces around the edge. On Easy, show a faint ghost of the full image in the target frame; on Medium and Hard, no ghost.
- If `rotation` is on, pieces start at random 90° rotations and a tap rotates them.
- Drag pieces in, and they snap when within about 30px of their correct spot (and correctly rotated), with a satisfying click sound.
- Solved when all pieces are placed. The completed image *is* the clue, so it transitions straight into the reveal.
- **Hint:** briefly flash one unplaced piece's target outline.

### 6.2 Marble Run
- Matter.js scene: a marble drop at the top and a goal cup at the bottom. Fixed walls and obstacles make up the level.
- A tray at the bottom holds 2–4 draggable pieces: straight ramp, curved ramp, funnel, bouncer. The child drags them into highlighted "build zones" and can tap a placed piece to rotate it 45°.
- A big **GO** button drops the marble. If it misses, it rolls off screen, resets after 2s, and the pieces stay put.
- Solved when the marble settles in the cup.
- Ship **5 hand-designed levels** (level 1 has 1 gap and 2 pieces; level 5 has 4 gaps, 6 pieces including a decoy piece that isn't needed, and a moving obstacle). Store the levels as JSON so more can be added easily.
- **Free-build extra:** after solving, an optional sandbox button lets him keep playing with the pieces. He loves building marble runs, so this is worth it. The clue is already revealed, so it doesn't hold up the hunt.
- **Hint:** show a ghost of one correct piece in its correct zone and rotation.

### 6.3 Fix the Train Track
- A `gridSize × gridSize` grid of track tiles (straight, curve, and optionally a cross). A station sits on one edge and the clue building on the opposite edge.
- Tap a tile to rotate it 90° with a small animation.
- When a continuous path connects, a little train chugs along it (animated along the path) and toots.
- Generate the puzzle by building a valid path first, filling the other cells with random tiles, then randomly rotating everything. Ensure the start state isn't already solved.
- **Hint:** lock one correct path tile into place with a green glow.

### 6.4 Memory Match
- `pairs` pairs of face-down cards in a grid. Tap two to flip them. A match stays up with a sparkle; a mismatch flips back after 1s.
- Card faces use the parent-uploaded `photoUrls` (house objects, pets, family) if provided. Otherwise use a built-in set of bright illustrations (vehicles, animals, tools). Use no copyrighted characters.
- Solved when all pairs are matched.
- **Hint:** briefly flip all cards face-up for 1.5s.

### 6.5 Flick Golf
- Side-on 2D golf with Matter.js physics. Drag back from the ball to aim, shown as a dotted trajectory preview for the first bit of the arc. Release to shoot.
- Unlimited shots. The ball respawns at the last resting spot if it goes off screen.
- `holes` short holes played in sequence (hole 1 is a flat approach; later holes add a hill, then a gap to clear).
- Solved when the final hole is sunk.
- Later holes can include a bounce pad, a water hazard (ball respawns) and a moving platform.
- **Hint:** show the full trajectory preview for the next shot.

### 6.6 Counting Lock
- A chunky combination padlock with `digits` dials (0–9 each). With one dial, allow 0–99. Use up and down arrow buttons rather than swiping.
- Each dial has its own real-world question, shown as text and spoken (parent's recorded audio if provided, otherwise speech synthesis). For example: dial 1 "How many cushions are on the couch?", dial 2 "How many windows in the kitchen?", dial 3 "How many wheels on your bike?" This sends him around the house to investigate.
- Questions can include simple sums the parent writes ("chairs at the table plus cushions on the couch").
- An **"Open!"** button checks the combination. Correct dials glow green so he knows which ones to recount. A wrong answer gets a rattle and "Close! Check again," with no penalty.
- Solved when the lock swings open.
- **Hint:** for one wrong dial, "It's more than X" / "less than Y", spoken.

---

## 7. Setup side (parent)

All under `/setup`, protected by a PIN. The layout is desktop- and iPad-friendly.

### 7.1 Hunt list
- List of hunts showing title, status and progress (for example "3 / 6 found").
- Actions: **New hunt**, **Duplicate** (copies the puzzle choices so you can re-shoot the photos for a new hunt), **Delete** (with confirmation).

### 7.2 Hunt editor
- Hunt title, child's name, treasure message.
- Station list (default 6; allow 3–10), reorderable by drag. Each station card shows:
  - **Hiding note** (parent-only)
  - **Puzzle type** dropdown plus the relevant options (pieces, level, pairs, question/answer, and so on)
  - **Clue photo** upload, which should accept iPad camera capture (`<input type="file" accept="image/*" capture="environment">`) or a file. Resize client-side to max 1600px and compress before uploading.
  - **Voice clue** recorder: record, stop, play back, re-record. Use `MediaRecorder` and handle Safari's `audio/mp4` output. Upload to Blob.
  - Clue text (optional)
  - For Memory Match: upload up to 8 card photos
  - For Counting Lock: number of dials, then question text, optional recorded question, and answer for each
  - Clue text with a "show to child" toggle (for riddle clues)
- Clear labelling that a station's clue points to the **next** hiding spot, for example "Clue to find station 3" on station 2's card, and "Clue to find the treasure" on the last station.
- **Validation** before a hunt can be set to *active*: every station needs a clue (a photo, or shown clue text) and valid puzzle config. Show a checklist of anything missing.
- Jigsaw stations need a clue photo, since the photo is the puzzle image.

### 7.3 Preview / test mode
- "Test station" button on each card opens the station in a preview that **does not affect progress**. This lets the parent play every puzzle before the day.
- **Reset progress** button, with confirmation.
- Live progress view: which stations are solved, with timestamps.

### 7.4 Printable QR sheet
- `/setup/hunts/{id}/print` is a print-optimised page (A4), one QR per half-page or quarter-page.
- Each QR shows a big friendly number or icon, a "Scan me! 📷" label, and the parent-only hiding note in tiny grey text at the bottom edge (to cut off or fold under).
- The URL encoded is the full production URL, including the station key.
- Regenerating keys (a button) invalidates old printed codes. Use this when reusing a hunt.

---

## 8. API sketch

```
POST   /api/setup/login                 { pin } → sets cookie
GET    /api/setup/hunts
POST   /api/setup/hunts
GET    /api/setup/hunts/:id
PUT    /api/setup/hunts/:id
DELETE /api/setup/hunts/:id
POST   /api/setup/hunts/:id/duplicate
POST   /api/setup/hunts/:id/reset
POST   /api/setup/hunts/:id/regenerate-keys
POST   /api/setup/upload                → Vercel Blob client upload token

GET    /api/play/:huntId/:stationId?k=  → { state: "play" | "notYet" | "solved" | "invalid", puzzle?, lastEarnedClue? }
POST   /api/play/:huntId/:stationId/solve?k=  → records completion, returns clue
```

Do not send the clue to the client before the puzzle is solved, except for Jigsaw, which needs the photo. This stops a curious kid from finding it in the network tab.

---

## 9. Build phases

Build in this order and get each phase working end to end before moving on.

1. **Skeleton:** Next.js app, Redis and Blob wiring, PIN login, hunt CRUD, station editor (photo upload and text only), station play route with order enforcement, and a placeholder "Tap to solve" puzzle, clue reveal and finale. Printable QR sheet. **A full hunt should be playable end to end at this point.**
2. **Audio:** voice clue recording and playback, speech-synthesis instructions, the iOS audio unlock pattern, sound effects.
3. **Puzzles**, one at a time, each tested in preview mode: Jigsaw → Memory Match → Counting Lock → Train Track → Flick Golf → Marble Run (the physics ones last).
4. **Polish:** celebrations, hints, portrait-lock screen, "not yet" screen, duplicate hunt, regenerate keys, validation checklist.

---

## 10. Acceptance criteria

- The parent can create a 6-station hunt on an iPad, including taking photos and recording voice clues, with no code.
- The printed QR codes, scanned with the iPad Camera app, open the correct station in Safari.
- Scanning out of order never reveals a future clue.
- Progress survives page reloads, closed tabs and re-scans.
- At Medium difficulty, every puzzle is a real challenge for a capable 7-year-old but solvable in under 5 minutes without adult help.
- Every instruction is spoken as well as written, so reading is never a blocker.
- The difficulty preset visibly changes every puzzle.
- All play screens work in iPad Safari in landscape, with no accidental zooming or scrolling during games.
- Test mode lets the parent play every station without affecting live progress.
- An existing hunt can be duplicated, re-photographed, re-keyed and reprinted for the next birthday.

---

## 11. Out of scope (for now)

- Multiple children or competitive play
- Native app / App Store
- Outdoor GPS-based stations
- Accounts beyond the single parent PIN