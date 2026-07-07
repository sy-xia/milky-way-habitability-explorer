# Accessibility Notes -- Milky Way Habitability Explorer

Target: WCAG 2.1 AA (AAA where reasonable). Built on the KL-UNL foundation
(shared palette, focus ring, `.sr-only`, masthead dialog focus management).

> Human screen-reader QA is still required. The notes below describe the
> affordances that were built in; they are not a substitute for testing with real
> NVDA (Windows) and VoiceOver (macOS/iOS) users.

## Structure & landmarks

* One `<h1>` only -- rendered by `<kl-unl-masthead>` (the sim adds none).
* `<main>` landmark; each panel is a `<section>` with an `<h2>` (the galaxy map's
  `<h2>` is `.sr-only` to preserve the original's chrome-free image while keeping a
  correct, non-skipping heading order).
* `<html lang="en">`. A "Skip to simulation" link is the first focusable element.

## Text alternatives (1.1.1)

* **Galaxy canvas** `role="img"` with a dynamic `aria-label` that states the
  current ring distance and the Sun's location, updated from `render()`:
  e.g. *"Top-down map of the Milky Way galaxy. A pink ring marks the selected
  distance of 18.0 kiloparsecs from the galactic center. The Sun lies about 8
  kiloparsecs from the center."*
* **Each plot canvas** `role="img"` with a dynamic `aria-label` describing the
  curve's shape **and** the selected distance, e.g. *"Line graph: extinction risk
  is very high near the galactic center and falls steeply, leveling off at large
  distances. A red marker shows the selected distance, 18.0 kiloparsecs."*
* The Sun dot / label and image credit are real HTML (zoomable, legible); the dot
  is `aria-hidden` (decorative) while "Sun"/"NASA/JPL-Caltech" remain readable.

## Color & contrast (1.4.1 / 1.4.3 / 1.4.11)

* Palette comes from KL-UNL CSS variables. Body text is dark charcoal on white
  (> 7:1).
* **No state is encoded by color alone.** The distance is always available as: the
  slider value + `aria-valuetext`, the visible "N.N kpc" read-out, and the live
  region -- in addition to the ring/marker position.
* **Color remap:** the marker was changed from the original salmon-red
  (#fe5f5f / #ff0000) to KL-UNL `--alert-color-r` (#ea351f, ~4.9:1 on white) for a
  reliable >= 3:1 graphical contrast. The galaxy ring keeps its original #ff8080
  (a graphical object on the dark map, >= 3:1).

## Keyboard (2.1.1 / 2.1.2 / 2.4.7)

* Everything is operable by keyboard in a logical tab order; focus ring is the
  foundation's `:focus-visible`.
* **Distance slider** is a native `<input type="range">`, so it supports the full
  set for free and never "sticks":
  * Left / Down = -0.1 kpc, Right / Up = +0.1 kpc
  * Page Down / Page Up = larger step
  * Home = 1.2 kpc (min), End = 22 kpc (max)
  * Tab moves away normally (no trap). Canvas pointer handlers do not steal focus.
* The masthead dialog (About/Help) traps + restores focus itself; the sim does not
  interfere.

## Screen-reader narration (NVDA + VoiceOver)

* **Units are always spoken with numbers.** The slider's `aria-valuetext` is the
  full phrase *"Distance from galactic center, 18.0 kiloparsecs"* (quantity + value
  + spelled-out unit) -- never a bare number.
* **Live region** (`aria-live="polite"`, `.sr-only`) announces committed changes
  with units and context: *"Distance from galactic center set to 12.3
  kiloparsecs."* Announcements fire on **commit** (pointer release, Reset), not on
  every drag tick, to avoid flooding. Slider changes are announced by the native
  control's own `aria-valuetext`, so they are not duplicated in the live region.
* The canvas `aria-label`s double as the "what's on screen now" description for
  audio-only users and are kept in sync from the single `render()`.

## Math / MathJax (rules 8 / 8a)

* This sim has no equations. Its only mathematical content is the graph axis
  numbers (0, 5, 10, 15, 20), the unit **kpc**, and the distance read-out. These
  are typeset with MathJax (inline `\( \)` / `\mathrm{kpc}`) from a **local**
  `foundation/tex-mml-chtml.js` (no CDN). Right-clicking the typeset numbers/units
  opens MathJax's "Show Math As" menu; the MathJax context menu is not disabled.
* **Graceful fallback:** if the local MathJax build is absent, the same labels
  render as clean plain text (identical glyphs for these simple values), so the sim
  is fully usable offline. Prose in axis titles ("distance from center",
  "extinction risk", "heavy elements abundance") is normal HTML by design -- only
  the numbers/units are math.
* **Nothing mathematical is baked onto the `<canvas>`.** All numbers/units live in
  HTML overlays (so they zoom and are exposed to MathJax and the screen reader);
  the canvas carries only the curves, axes, arrows, and marker line.

## Timing / motion (2.2.2 / 2.3.3)

* No autonomous animation, no flashing, no timed content. Every change is
  user-driven and instantaneous, so no Pause control is needed.
  `prefers-reduced-motion` is honored (there is nothing to reduce).

## Zoom / reflow (1.4.4 / 1.4.10)

* All type is in `rem`/`em`; body copy floor is ~1.125rem. Layout uses relative
  units and reflows to a single column below the foundation's 56rem breakpoint and
  again for phone portrait, with no horizontal scroll and no clipped text at 200%
  zoom. Canvases keep their original internal coordinates and are scaled by CSS
  (`width:100%; height:auto`), so drawing/physics math is unchanged at any size.

## Touch (2.5.x)

* Pointer Events give mouse + touch one code path. Draggable plot canvases set
  `touch-action: none` so dragging never scrolls/zooms the page; pointer coords are
  mapped back through the current scale so the drag math matches the source at any
  display size. Interactive targets meet the >= 44px minimum. No hover-only
  affordances.

## Known items for human QA

* Verify NVDA and VoiceOver both read the slider as name + value + unit, and that
  the live-region announcement is not duplicated with the slider's own value.
* Verify the MathJax right-click menu once the local `tex-mml-chtml.js` is present.
