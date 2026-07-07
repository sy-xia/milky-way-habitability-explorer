# Milky Way Habitability Explorer -- HTML5

An accessible HTML5 rebuild of the legacy Flash "Milky Way Habitability Explorer"
simulation, built on the shared KL-UNL foundation.

## This sim MUST be served over HTTP -- it will NOT run from a double-clicked file

Opening `index.html` directly (a `file://` path) shows an empty or broken title
bar. **Why:** the KL-UNL masthead component (`foundation/kl-unl-masthead.js`)
loads its title / Help / About text with `fetch('foundation/contents.json')`, and
browsers block `fetch()` of local files under the `file://` protocol for security
(the same-origin policy). Served over HTTP the fetch succeeds and the sim loads
normally.

## How to run it locally

Serve the `html5/` folder with any static HTTP server, then open the root URL.
Because you serve from **inside** `html5/`, the sim is at the server root -- the
URL is `http://localhost:8123/`, **not** `.../html5/index.html`.

Pick whichever you have installed:

```
# Python 3
python3 -m http.server 8123
#   then open http://localhost:8123/

# Node
npx serve
#   or
npx http-server

# VS Code
#   Install the "Live Server" extension, then "Open with Live Server".
```

If you have neither Python nor Node (e.g. a bare Windows box), a tiny PowerShell
static server is included at `../.claude/serve.ps1`. From the project root:

```
powershell -NoProfile -Command "$Port=8123; iex (Get-Content '.claude/serve.ps1' -Raw)"
#   then open http://localhost:8123/
```

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works. The
`file://` limitation only affects local double-clicking.

## MathJax

The sim's numeric axis labels, units, and the distance readout are typeset with
MathJax, loaded from a **local** copy at `foundation/tex-mml-chtml.js` (no CDN).
That file is supplied by the KL-UNL pipeline and is not bundled here. If it is
absent the sim still works: the math **degrades gracefully to clean plain text**
(you simply don't get the MathJax right-click "Show Math As" menu). Drop the
MathJax build into `foundation/` to enable full typesetting.

## Layout

```
html5/
  index.html            KL-UNL scaffold: .app-shell + <kl-unl-masthead> + panels
  foundation/           copied UNCHANGED from the project foundation/ (see notes)
  styles/styles.css     sim-specific styles only (foundation CSS is untouched)
  simulation.js         all sim logic (state, render, drag, keyboard, a11y)
  assets/               reused exported bitmap (milkyway.jpg = images/33.jpg)
  README.md             this file
  CONVERSION_NOTES.md   behavior model, AS->HTML5 mapping, deviations
  ACCESSIBILITY.md      WCAG affordances, ARIA, keyboard map, SR wording
```
