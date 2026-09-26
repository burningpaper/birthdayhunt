# Design Direction: Toybox Plastic

> Reading this as: a touch game for a confident seven-year-old on an iPad, with a colourful shiny-plastic language, leaning toward chunky bevelled controls, one colour per puzzle, spring motion and synthesized sound. Game-like, never babyish.

## The idea

Picture the best toy on the shelf. Hard, glossy plastic in a handful of loud colours, with a highlight across the top where the light catches it and a darker lip underneath where it sits on the table. Press a button and it sinks with a click.

That is the whole language. Every control on the play side is a piece of that plastic, sitting on a deep navy "toybox" backdrop that makes the colours glow. Nothing is flat, nothing is pastel, and nothing looks like a preschool worksheet. The references are Nintendo hardware and the chunky buttons of good mobile games, not a picture book.

## Dials

`DESIGN_VARIANCE 5` / `MOTION_INTENSITY 7` / `VISUAL_DENSITY 2`.

Play screens are one big idea at a time, so they stay airy and centred on the action. Motion is high because it is feedback: things pop, sink, wobble and celebrate. Setup screens drop to motion 3 and density 5; they are a calm tool for a parent.

## Colour: one plastic per puzzle

Each puzzle type owns a colour, so a station has an identity the moment it opens. The rule is semantic, and it is the only way colours get assigned.

| Puzzle | Plastic | Hex | Text on it |
|---|---|---|---|
| Jigsaw | Tomato | `#F0453A` | cream |
| Marble Run | Cobalt | `#2F6BEA` | cream |
| Train Track | Grass | `#22A94F` | cream |
| Memory Match | Sunflower | `#FFC21A` | ink |
| Flick Golf | Tangerine | `#FF8A1F` | ink |
| Counting Lock | Bubblegum | `#F0508F` | cream |

Neutrals: **Toybox** `#101C3C` (backdrop), **Toybox glow** `#1E3470`, **Ink** `#14213F`, **Cream** `#FFF7E8`. Sunflower doubles as the "treasure" colour on the finale.

Yellow and orange carry ink text, because cream on them fails contrast. Plastic labels are always large and bold (3:1 is the floor we hold to).

## The plastic recipe

One CSS utility, `.plastic`, driven by a single `--plastic` colour. Everything else is derived with `color-mix()`:

1. **Body:** vertical gradient from a lighter tint down to the base colour.
2. **Gloss:** a `::before` highlight across the top 45%, white fading to clear, inset from the edges like light on a curved surface.
3. **Rim light:** a 2px inset white line along the top edge.
4. **Lip:** a solid 6px darker shade below (`box-shadow: 0 6px 0`), which is what makes it read as a physical object.
5. **Cast shadow:** a soft, navy-tinted shadow under the lip. Never pure black.
6. **Press:** on `:active` it drops 4px and the lip shrinks to 2px in 90ms. Paired with a click sound, so the button feels real.

Text on plastic gets a 2px shadow in the lip colour, which is the classic game-button emboss.

## Shape

One rule, applied everywhere:
- Buttons: 20px radius. Round icon buttons (speaker, dial arrows): full circle.
- Panels and screens-within-screens: 32px.
- Small game tiles (cards, track tiles): 14px.

## Type

- **Display: Lilita One.** Chunky, confident, game-poster energy. Headlines, the "Tap to start" button, dial numbers, "You did it!". Never used for paragraphs.
- **UI and body: Outfit** (500 to 800). A clean geometric sans for the one-line instructions a seven-year-old reads, and for the whole Setup side.

Play text is short and big: instructions are one line, at least 28px. Reading is never required, because every instruction is spoken too.

## Motion

Motion is feedback, never decoration. It comes from the `motion` library, using springs, never linear easing.
- **Pop in:** new screens and pieces spring from 0.85 scale (stiffness 260, damping 20).
- **Press:** the CSS sink described above.
- **Wrong answer:** a horizontal rattle, never a red flash or buzzer.
- **Solve:** confetti in the station's own plastic colours, then the clue slides up.
- **Idle glow:** only the hint button pulses, and only once a hint is available. Nothing else loops.

Under `prefers-reduced-motion`, springs become short fades and confetti is a single burst.

## Sound

Every sound is synthesized with the Web Audio API, so there are no audio files to load. A short plastic "tock" on every press, a rising chirp when something snaps into place, and a four-note fanfare when a puzzle is solved. All of it unlocks from the "Tap to start" press.

## Start screen

While a hunt is live, the front page is nothing but one big (18rem) glossy tomato-red round button with a play glyph, on the toybox backdrop. A soft red halo breathes behind it to invite a tap. While the welcome plays, the glyph becomes a speaker and rings ripple outward; then the scanner opens.

## Voice

The app never talks in a synthesized voice. Everything it says is the parent's own recording: each station's clue and lock questions, and 17 hunt-wide "voice lines" (the start screen's welcome, instructions, celebrations, "Go find it!", "Not yet!", the lock's nudges), each uploaded as an audio file or recorded in setup. A line without a recording is simply not said; its words are always on screen. A speaker button only appears when there is something to play.

## Icons

Phosphor, **fill** weight only, at one size step per context. No emoji in the interface: the spec's 🔍, 📷 and 🔊 become Phosphor's magnifying glass, camera and speaker glyphs.

## Marble Run: the one 3D scene

Marble Run is the only puzzle drawn in real 3D (three.js via React Three Fiber, loaded only on its own stations). It extends the plastic idea rather than breaking it. A wooden pegboard stands on a wooden table, seen at a gentle three-quarter angle. The tracks are clear candy-plastic tubes that click together with cream collars. Fixed pieces are ice blue; the child's pieces use the plastic colours: straight tangerine, curve bubblegum, loop sunflower. The marble is a glossy tomato red with a pale swirl so you can see it roll. The goal is a green bucket with a sunflower flag. All the lighting is generated in code from glowing panels, and the textures are painted in code, so nothing is downloaded. The whole board is buildable, so there are no marked squares: the one under a dragged piece glows as a sunflower dashed outline, with a see-through preview of the piece snapped in place. Obstacles are slate-blue plastic blocks with four studs, like toy bricks. Stars are chunky extruded gold stars floating in front of their squares, turning and bobbing gently; the marble bursts each one it rolls through (it grows and fades, with a three-note twinkle), and a row of star glyphs top-left fills with glowing sunflower as they're collected. The tray is one tile per piece type with a cobalt "×n" count badge; a type that runs out fades but stays.

## Setup side

The parent tool shares the same fonts, radii and puzzle colours, but on a light, calm surface (`#F6F7FB`) with ink text. Plastic appears only where it earns its place: the primary action on each screen and the puzzle-colour chip on each station card. It is a light-only tool, a deliberate choice for something used a few times a year on an iPad or a Mac.

## Living reference

`/styleguide` renders every token and component in the real app. Check changes there first.
