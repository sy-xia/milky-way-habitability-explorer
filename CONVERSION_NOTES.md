# Conversion Notes -- Milky Way Habitability Explorer (Flash AS1 -> HTML5)

## Behavior model (one paragraph)

The simulation has a single shared state value: **radius**, the distance from the
galactic centre in kiloparsecs (kpc). The user changes it by dragging a red
vertical marker on either of two graphs, or (in this HTML5 version) with an
accessible slider. Changing the value fans out to three synchronized views:
(1) a **ring** drawn on a top-down map of the Milky Way, whose on-screen radius is
`radius * 19` pixels; (2) the marker on the **Catastrophic Event Probability
Graph** (extinction risk vs. distance); and (3) the marker on the **Heavy Elements
Abundance Graph** (metallicity vs. distance), each marker at `radius * 14.7` px.
The value is clamped to `[1.2, 22]` kpc and reset to `18`. There is no animation,
timer, randomness, or physics integration -- it is a direct read-out explorer.

## Constants (verbatim from the ActionScript)

| Constant        | Value | Source |
|-----------------|-------|--------|
| `minRadius`     | 1.2   | `scripts/DefineSprite_64/frame_1/DoAction.as` |
| `maxRadius`     | 22    | same |
| initial / reset | 18    | `onReset()` -> `setRadius(18)` |
| galaxy `scale`  | 19    | `scripts/MilkyWayComponent.as` (px per kpc, ring) |
| plot `scale`    | 14.7  | `scripts/RiskPlot.as`, `scripts/MetalsPlot.as` (px per kpc, marker) |
| ring points     | 12    | `precomputePoints(12)` |
| ring colour     | 0xFF8080 | `lineStyle(3,16744576,100)` -> #ff8080, width 3 |

## AS1 -> HTML5 mapping

| ActionScript (AS1) | HTML5 port |
|--------------------|------------|
| `DefineSprite_64` `setRadius(r)` clamp + fan-out | `simulation.js` `setRadius()` |
| `onReset()` -> `setRadius(18)` | masthead `sim-reset` listener -> `setRadius(18)` |
| `MilkyWayComponent.precomputePoints(12)` + `drawDisc()` (12-point `curveTo` circle, `-sin` screen-Y) | `precomputeRing()` + `drawGalaxy()` with `quadraticCurveTo`, same coords/`-sin` |
| `MilkyWayComponent` disc mask rect -423..423 x, -150..150 y | 846x300 canvas (the canvas **is** the mask; drawing is naturally clipped) |
| galaxy bitmap (symbol/shape 34, `images/33.jpg`) placed centred on the galactic centre | `ctx.drawImage(img, -9, -246, 864, 792)` -- reused as-is (see "Reused assets") |
| `RiskPlot` / `MetalsPlot` `setCursorRadius` -> `cursorMC._x = r*14.7` | `strokeCursor()` draws the marker at `r*14.7` |
| `RiskPlot`/`MetalsPlot` `onCursorDragged(arg)` -> `setRadius(arg/14.7)` | plot `pointermove` -> `setRadius((axisX-offset)/14.7)` |
| `Cursor.as` `onPress` (`xOffset=_xmouse-_x`), `onMouseMoveFunc` (`onCursorDragged(_xmouse-xOffset)`), `onRelease` | `attachPlotDrag()` pointer events with identical offset math |
| static risk curve `shapes/57.svg` (stroke #3399ff) | `strokeRiskCurve()` -- **verbatim path data** + its `translate(-14,-5)` |
| static metals line `shapes/51.svg` (stroke #3399ff) | `strokeMetalsCurve()` -- **verbatim path data** + its `translate(2,-12.65)` |
| axis L-shape `shapes/47.svg`, ticks `shapes/41.svg`, arrowheads `shapes/48.svg` etc. | `strokeAxes()` (code-drawn, matching geometry) |
| `Title Bar` sprite (title + about/help/reset) | shared `<kl-unl-masthead>` component |
| `Dialog Window v2` (About/Help modals) | masthead's own dialog, content from `contents.json` |
| on-screen strings (`texts/*.txt`) | verbatim in `index.html` / labels (see below) |
| `trace()`, `updateAfterEvent()`, FUIComponent framework | dropped / no-op (per idiom guidance) |

### Verbatim on-screen text reused

* Panel titles: "Catastrophic Event Probability Graph", "Heavy Elements Abundance
  Graph" (`DefineSprite_64` panel `initialize` blocks).
* Help lines: risk = `texts/63.txt`, metals = `texts/62.txt` (verbatim).
* Axis titles: "distance from center (kpc)" (`texts/40.txt`), "extinction risk"
  (`texts/58.txt`), "heavy elements abundance" (`texts/39.txt`).
* Tick labels 0/5/10/15/20 (`texts/42-46`), "Sun" (`texts/37`),
  "NASA/JPL-Caltech" (`texts/35`).

## Reused assets vs. code-drawn

* **Reused as-is (bitmap):** `images/33.jpg` -> `assets/milkyway.jpg`, drawn with
  `drawImage` at the original placement/size so the central band shows exactly as
  in the original (the round artwork is letter-boxed by the 846x300 stage).
* **Reused geometry (vector):** the two graph curves use the **exact path
  coordinates** from `shapes/57.svg` (risk) and `shapes/51.svg` (metals), including
  their original transforms -- not hand-redrawn. The risk curve is nudged +6px in x
  (translate `-14` -> `-8`) at the user's request so it starts just clear of the
  y-axis rather than on it; the curves are decorative artwork (no formula), so this
  is a purely visual adjustment.
* **Code-drawn (no exported file):** the galactic ring (built at runtime by
  `MilkyWayComponent.drawDisc`), the plot axes / arrowheads / tick marks, and the
  draggable marker line. These are reproduced on `<canvas>` with matching geometry.

## Deviations from the original (and why)

1. **Accessible distance slider added.** The original is drag-only. A single
   native `<input type="range">` ("Distance from galactic center") is added as the
   keyboard-operable equivalent of the two draggable markers (WCAG 2.1.1). It
   drives the same `setRadius()` as the pointer path, so behavior is identical.
   A small numeric read-out ("18.0 kpc") accompanies it; the original showed no
   number, but this is the input value only -- no derived educational quantity is
   invented.
2. **Marker grab tolerance widened + click-to-set.** The original cursor hit area
   is ~6 px wide. For touch/pointer accessibility the grab tolerance is widened to
   ~24 px, and pressing elsewhere on the plot jumps the marker to the press point.
   The resulting `radius = pointerX/14.7` math is unchanged; only the target size
   and an added convenience differ.
3. **Cursor colour remapped** from the original salmon-red (#fe5f5f/#ff0000) to the
   KL-UNL alert red `--alert-color-r` (#ea351f) for contrast. State is never
   conveyed by colour alone (slider, read-out, and ARIA all carry the value).
   See ACCESSIBILITY.md.
4. **Layout follows the KL-UNL shell**, not the original Flash pixel layout:
   panels/reading order are reproduced with KL-UNL classes and a sim-specific
   stacked grid (galaxy -> distance control -> two graphs), reflowing to a single
   column on narrow/portrait widths. Visual intent matches `Capture.PNG`.
5. **No animation / Pause / reduced-motion handling needed.** The original has no
   autonomous animation (no `onEnterFrame`, timer, or randomness); every change is
   user-driven and instantaneous, so there is nothing to pause. `prefers-reduced-
   motion` is honored trivially.
6. **file:// notice.** The shared masthead fetches `contents.json`, which browsers
   block over `file://`, so double-clicking `index.html` yields a title bar that
   silently fails to load. A small amber notice (in the sim's own DOM, not the
   foundation) is shown only when `location.protocol === 'file:'`, telling the user
   to serve over HTTP. Served over HTTP it never appears.

## IMPORTANT: pre-existing defects fixed in the copied `contents.json`

The provided shared `foundation/contents.json` is **invalid JSON as delivered** --
`JSON.parse` (and therefore the masthead) fails on it for *every* sim. The defects
are in unrelated entries, not this sim's. To make the deliverable load, the
following were corrected **only in the copy at `html5/foundation/contents.json`**,
with **zero change to any entry's actual text**:

* **4 raw newlines inside string literals** (JSON forbids literal control chars in
  strings): the `content` values around lines 200/201, 438, 916/917, 1155/1156.
  Each stray newline was replaced with a single space (or removed where it sat
  between `</p>` and the closing quote).
* **1 literal TAB inside a string** (around line 1220) -> replaced with a space.
* **2 unescaped `"` around `href` attributes** in the `renaissancePtolemaic` and
  `variableStarPhotometryAnalyzer` help strings (`href="..."` -> `href=\"...\"`).

No `.js` / `.css` foundation file was modified. **This sim's `milkyWayHabitability`
entry already existed** in the shared file (title/help/about all present and
correct), so no entry was added -- the only edits were the JSON-validity repairs
above. **Recommend the same fixes be applied upstream in the shared
`contents.json`**, since the file is currently broken for the whole pipeline.

## contents.json model

Per-sim copy model (the documented default): a full copy lives in
`html5/foundation/contents.json`. This sim's entry (`sim-id="milkyWayHabitability"`)
was already present, so nothing was added -- see above.
