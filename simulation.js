/* ============================================================================
   Milky Way Habitability Explorer  --  HTML5 / KL-UNL port
   ----------------------------------------------------------------------------
   Behavior ground truth: the decompiled ActionScript (AS1).
     * A single shared quantity "radius" = distance from the galactic centre,
       in kiloparsecs (kpc). Clamped to [minRadius, maxRadius]; reset -> 18.
         - minRadius = 1.2, maxRadius = 22            (DefineSprite_64 frame 1)
         - onReset()  -> setRadius(18)
     * The galaxy component draws a ring of pixel radius = radius * 19.
         - MilkyWayComponent.scale = 19               (MilkyWayComponent.as)
         - ring is a 12-point curveTo polygon, stroke colour 0xFF8080, width 3
     * Each plot places a draggable vertical cursor at x = radius * 14.7 px.
         - RiskPlot.scale = MetalsPlot.scale = 14.7    (RiskPlot.as / MetalsPlot.as)
         - Cursor.onMouseMoveFunc: parent.onCursorDragged(_xmouse - xOffset)
           -> setRadius((_xmouse - xOffset) / 14.7)     (Cursor.as)
     * Dragging either cursor, or the accessible slider, updates the one shared
       radius; the ring and both cursors move together (setRadius fans out to
       galaxyMC, riskPlotMC, metalsPlotMC).
   Presentation ground truth: the KL-UNL foundation + WCAG 2.1 AA.
   ========================================================================== */

(function () {
  'use strict';

  /* ----------------------------- constants -------------------------------- */
  // Verbatim from the ActionScript source.
  var MIN_RADIUS   = 1.2;    // kpc  (DefineSprite_64: minRadius)
  var MAX_RADIUS   = 22;     // kpc  (DefineSprite_64: maxRadius)
  var INIT_RADIUS  = 18;     // kpc  (onReset -> setRadius(18))
  var GALAXY_SCALE = 19;     // px per kpc for the ring   (MilkyWayComponent.scale)
  var PLOT_SCALE   = 14.7;   // px per kpc for the cursor (Risk/MetalsPlot.scale)

  // Galaxy stage geometry (from MilkyWayComponent mask + shape 34 placement).
  var GAL_W = 846, GAL_H = 300;          // mask rect -423..423 x, -150..150 y
  var GAL_CX = 423, GAL_CY = 150;        // galactic centre = stage origin
  var GAL_IMG_X = -9, GAL_IMG_Y = -246;  // image top-left so its centre = centre
  var GAL_IMG_W = 864, GAL_IMG_H = 792;  // shape 34 image dimensions
  var SUN_KPC = 8;                       // Sun ~8 kpc from centre (decorative marker)

  // Plot stage geometry (axis-box coords; shared by both graphs).
  var PLOT_PADX = 6, PLOT_PADY = 16;     // offset of axis box within the canvas
  var AXIS_W = 355, AXIS_H = 210;        // shape 47 axis box
  var TICKS_KPC = [0, 5, 10, 15, 20];    // x-axis tick values (texts 42-46)
  var TICK_X = TICKS_KPC.map(function (k) { return k * PLOT_SCALE; }); // 0,73.5,...,294

  // Reused exported vector geometry (verbatim path data).
  //   Risk curve  = shapes/57.svg, transform translate(-14,-5)
  //   Metals line = shapes/51.svg, transform translate(2,-12.65)
  var RISK_START = { x: 15.0, y: 6.0 };
  var RISK_SEGS = [
    [17.25, 26.45, 24.35, 51.2],
    [38.45, 100.8, 62.5, 122.5],
    [75.8, 134.5, 96.45, 142.55],
    [117.1, 150.6, 149.7, 156.45],
    [180.2, 161.9, 229.05, 166.85]
  ];
  var RISK_END = { x: 341.5, y: 176.5 };
  var METALS_A = { x: -1.0, y: 13.65 };
  var METALS_B = { x: 345.0, y: 196.9 };

  // Colours (original values, remapped only where noted -- see ACCESSIBILITY.md).
  var RING_COLOR   = '#ff8080';   // 0xFF8080, verbatim
  var CURVE_COLOR  = '#3399ff';   // #3399ff, verbatim from the shape strokes
  var CURSOR_COLOR = '#ea351f';   // remap of red cursor -> KL-UNL --alert-color-r
  var AXIS_COLOR   = '#000000';   // black axes/ticks (shapes 41/47)

  /* ------------------------------- state ---------------------------------- */
  var state = { radius: INIT_RADIUS };

  /* --------------------------- 12-gon ring points ------------------------- */
  // MilkyWayComponent.precomputePoints(12): a 12-point curveTo circle.
  var RING_N = 12;
  var ringAnchors = [], ringControls = [], ringStart;
  (function precomputeRing() {
    var step = (2 * Math.PI) / RING_N;
    var halfStep = step / 2;
    var cRad = 1 / Math.cos(halfStep);
    for (var i = 0; i < RING_N; i++) {
      var th = (i + 1) * step;
      ringAnchors.push({ x: Math.cos(th), y: -Math.sin(th) });         // AS negates sin
      var ca = th - halfStep;
      ringControls.push({ x: cRad * Math.cos(ca), y: -cRad * Math.sin(ca) });
    }
    ringStart = { x: ringAnchors[RING_N - 1].x, y: ringAnchors[RING_N - 1].y }; // (1,0)
  })();

  /* ----------------------------- DOM handles ------------------------------ */
  var galaxyCanvas, galaxyCtx, riskCanvas, riskCtx, metalsCanvas, metalsCtx;
  var slider, readout, liveRegion;
  var galaxyImg = null, galaxyImgReady = false;

  /* --------------------------- canvas preparation ------------------------- */
  // Backing store at devicePixelRatio for crispness; drawing stays in the
  // original logical stage coordinates (CSS scales the element to fit).
  function prepCanvas(canvas) {
    var dpr = window.devicePixelRatio || 1;
    var lw = canvas.width, lh = canvas.height;   // logical size from HTML attrs
    canvas.width = Math.round(lw * dpr);
    canvas.height = Math.round(lh * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.__logical = { w: lw, h: lh };
    return ctx;
  }

  /* ------------------------------ formatting ------------------------------ */
  function fmt(r) { return r.toFixed(1); }          // one decimal, like a readout
  function spoken(r) {
    return 'Distance from galactic center, ' + fmt(r) + ' kiloparsecs';
  }

  /* ------------------------------ MathJax --------------------------------- */
  // Typeset a small piece of math; degrade to clean plain text if MathJax is
  // not present (offline / not yet loaded). Re-typeset once MathJax is ready.
  var mathEls = [];
  function typesetMath(el, latex, fallback) {
    el.__latex = latex;
    el.__fallback = fallback;
    if (mathEls.indexOf(el) === -1) mathEls.push(el);
    if (window.MathJax && window.MathJax.typesetPromise) {
      el.innerHTML = '\\(' + latex + '\\)';
      window.MathJax.typesetClear && window.MathJax.typesetClear([el]);
      window.MathJax.typesetPromise([el]).catch(function () {
        el.textContent = fallback;
      });
    } else {
      el.textContent = fallback;
    }
  }
  // Called from the MathJax startup hook wired in index.html.
  window.__mwOnMathJaxReady = function () {
    mathEls.forEach(function (el) { typesetMath(el, el.__latex, el.__fallback); });
  };

  /* ----------------------------- drawing: galaxy -------------------------- */
  function drawGalaxy() {
    var ctx = galaxyCtx;
    ctx.clearRect(0, 0, GAL_W, GAL_H);
    if (galaxyImgReady) {
      ctx.drawImage(galaxyImg, GAL_IMG_X, GAL_IMG_Y, GAL_IMG_W, GAL_IMG_H);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, GAL_W, GAL_H);
    }
    // Habitability ring: pixel radius = radius * 19, clipped to the stage rect
    // (the canvas IS the original mask, so drawing is naturally clipped).
    var pr = state.radius * GALAXY_SCALE;
    ctx.beginPath();
    ctx.moveTo(GAL_CX + pr * ringStart.x, GAL_CY + pr * ringStart.y);
    for (var i = 0; i < RING_N; i++) {
      ctx.quadraticCurveTo(
        GAL_CX + pr * ringControls[i].x, GAL_CY + pr * ringControls[i].y,
        GAL_CX + pr * ringAnchors[i].x, GAL_CY + pr * ringAnchors[i].y
      );
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = RING_COLOR;
    ctx.stroke();
  }

  /* ----------------------------- drawing: plots --------------------------- */
  function strokeAxes(ctx) {
    ctx.strokeStyle = AXIS_COLOR;
    ctx.fillStyle = AXIS_COLOR;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // L-shaped axis: (0,0)-(0,H)-(W,H)   (shape 47)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, AXIS_H);
    ctx.lineTo(AXIS_W, AXIS_H);
    ctx.stroke();
    // y-axis arrowhead (up) -- shape 48. Base sits exactly on the axis top (y=0)
    // so the triangle touches the line with no gap.
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(-4.4, 0);
    ctx.lineTo(4.4, 0);
    ctx.closePath();
    ctx.fill();
    // x-axis arrowhead (right). Base sits exactly on the axis end (x=AXIS_W).
    ctx.beginPath();
    ctx.moveTo(AXIS_W + 11, AXIS_H);
    ctx.lineTo(AXIS_W, AXIS_H - 4.4);
    ctx.lineTo(AXIS_W, AXIS_H + 4.4);
    ctx.closePath();
    ctx.fill();
    // x-axis tick marks (shape 41): short verticals below the axis
    ctx.beginPath();
    for (var i = 0; i < TICK_X.length; i++) {
      ctx.moveTo(TICK_X[i], AXIS_H);
      ctx.lineTo(TICK_X[i], AXIS_H + 6);
    }
    ctx.stroke();
  }

  function strokeRiskCurve(ctx) {
    ctx.save();
    // shapes/57.svg transform was translate(-14,-5); nudged +6px in x so the
    // (decorative) curve starts just clear of the y-axis instead of on it.
    ctx.translate(-8, -5);
    ctx.beginPath();
    ctx.moveTo(RISK_START.x, RISK_START.y);
    for (var i = 0; i < RISK_SEGS.length; i++) {
      var s = RISK_SEGS[i];
      ctx.quadraticCurveTo(s[0], s[1], s[2], s[3]);
    }
    ctx.lineTo(RISK_END.x, RISK_END.y);
    ctx.strokeStyle = CURVE_COLOR;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function strokeMetalsCurve(ctx) {
    ctx.save();
    ctx.translate(2, -12.65);               // shapes/51.svg transform
    ctx.beginPath();
    ctx.moveTo(METALS_A.x, METALS_A.y);
    ctx.lineTo(METALS_B.x, METALS_B.y);
    ctx.strokeStyle = CURVE_COLOR;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function strokeCursor(ctx) {
    var x = state.radius * PLOT_SCALE;       // px = radius * 14.7
    // Span the plot area exactly: top of the axis box (y=0) down to the x-axis
    // (y=AXIS_H). Butt cap so the ends are flush and never overshoot the axis.
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, AXIS_H);
    ctx.strokeStyle = CURSOR_COLOR;
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  function drawPlot(ctx, curveFn) {
    var lg = ctx.canvas.__logical;
    ctx.clearRect(0, 0, lg.w, lg.h);
    ctx.save();
    ctx.translate(PLOT_PADX, PLOT_PADY);
    curveFn(ctx);          // reused exported curve, drawn under the axes/cursor
    strokeAxes(ctx);
    strokeCursor(ctx);
    ctx.restore();
  }

  /* ------------------------------- render --------------------------------- */
  function render() {
    var r = state.radius;
    drawGalaxy();
    drawPlot(riskCtx, strokeRiskCurve);
    drawPlot(metalsCtx, strokeMetalsCurve);

    // Sync the accessible slider. Setting .value does not fire 'input', and the
    // value always equals the current state, so this never fights an in-progress
    // slider drag -- but it DOES keep the slider in sync when a canvas marker is
    // dragged while the slider still holds focus (previously a guard skipped this
    // and the slider desynced from the markers).
    slider.value = String(r);
    slider.setAttribute('aria-valuetext', spoken(r));

    // Numeric readout: plain text on every frame (cheap). MathJax typesetting is
    // applied only at commit points (typesetReadout) so we don't re-typeset on
    // every drag tick when MathJax is present.
    readout.textContent = fmt(r) + ' kpc';

    // Dynamic image descriptions for screen readers.
    galaxyCanvas.setAttribute('aria-label',
      'Top-down map of the Milky Way galaxy. A pink ring marks the selected ' +
      'distance of ' + fmt(r) + ' kiloparsecs from the galactic center. ' +
      'The Sun lies about ' + SUN_KPC + ' kiloparsecs from the center.');
    riskCanvas.setAttribute('aria-label',
      'Line graph: extinction risk is very high near the galactic center and ' +
      'falls steeply, leveling off at large distances. A red marker shows the ' +
      'selected distance, ' + fmt(r) + ' kiloparsecs.');
    metalsCanvas.setAttribute('aria-label',
      'Line graph: heavy elements abundance is highest at the center and ' +
      'decreases steadily with distance. A red marker shows the selected ' +
      'distance, ' + fmt(r) + ' kiloparsecs.');
  }

  /* ------------------------------ setRadius ------------------------------- */
  // Mirrors DefineSprite_64 setRadius(): clamp, then fan out to every view.
  function setRadius(r, opts) {
    if (r < MIN_RADIUS) r = MIN_RADIUS;
    else if (r > MAX_RADIUS) r = MAX_RADIUS;
    state.radius = r;
    render();
    if (opts && opts.announce) announce(r);
  }

  function announce(r) {
    liveRegion.textContent =
      'Distance from galactic center set to ' + fmt(r) + ' kiloparsecs.';
  }

  // Typeset the readout via MathJax (falls back to plain text). Called at commit
  // points only -- see render() for the cheap per-frame plain-text update.
  function typesetReadout() {
    typesetMath(readout, fmt(state.radius) + '\\ \\mathrm{kpc}',
                fmt(state.radius) + ' kpc');
  }

  /* ------------------------- pointer drag on a plot ----------------------- */
  // Reproduces Cursor.as offset drag; adds click-to-set when the press is not
  // near the marker, and a generous grab tolerance for touch (>=44px target).
  var GRAB_TOL = 24;   // px in axis-box coords (~1.6 kpc)

  function plotPointerX(canvas, clientX) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.__logical.w / rect.width;    // CSS px -> logical px
    var internalX = (clientX - rect.left) * scaleX;
    return internalX - PLOT_PADX;                     // -> axis-box x
  }

  function attachPlotDrag(canvas) {
    var dragging = false, offset = 0;

    canvas.addEventListener('pointerdown', function (e) {
      var axisX = plotPointerX(canvas, e.clientX);
      var cursorX = state.radius * PLOT_SCALE;
      // Grab the marker with its offset (faithful), else jump to the press.
      offset = (Math.abs(axisX - cursorX) <= GRAB_TOL) ? (axisX - cursorX) : 0;
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      setRadius((axisX - offset) / PLOT_SCALE, { announce: false });
      e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var axisX = plotPointerX(canvas, e.clientX);
      setRadius((axisX - offset) / PLOT_SCALE, { announce: false });  // matches Cursor.as
      e.preventDefault();
    });

    function end(e) {
      if (!dragging) return;
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      announce(state.radius);     // announce on commit, not per tick
      typesetReadout();           // upgrade readout to MathJax on commit
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  /* --------------------------- label placement ---------------------------- */
  function placeAxisLabels(wrap) {
    var lw = 380;   // plot canvas logical width
    var ticks = wrap.querySelectorAll('.mw-xtick');
    for (var i = 0; i < ticks.length; i++) {
      var idx = parseInt(ticks[i].getAttribute('data-mw-x'), 10);
      var frac = (PLOT_PADX + TICK_X[idx]) / lw;
      ticks[i].style.left = (frac * 100).toFixed(3) + '%';
      typesetMath(ticks[i], String(TICKS_KPC[idx]), String(TICKS_KPC[idx]));
    }
    var title = wrap.querySelector('[data-mw-axis-title]');
    if (title) {
      // "distance from center (kpc)" -- unit typeset via MathJax, prose as text.
      title.innerHTML = 'distance from center (<span class="mw-unit"></span>)';
      typesetMath(title.querySelector('.mw-unit'), '\\mathrm{kpc}', 'kpc');
    }
  }

  /* --------------------------- file:// safety net ------------------------- */
  // The shared masthead (foundation, unmodifiable) fetches contents.json, which
  // browsers block over file://, so the title bar + buttons silently fail to load
  // when index.html is double-clicked. Show a clear notice in the sim's OWN DOM
  // (never touching the foundation) so the user knows to serve it over HTTP.
  function showFileProtocolNotice() {
    var el = document.createElement('div');
    el.className = 'mw-file-warning';
    el.setAttribute('role', 'alert');
    el.innerHTML =
      '<strong>Run this simulation from a local web server, not by opening the ' +
      'file directly.</strong> Because it was opened over <code>file://</code>, the ' +
      'title bar and its Reset / Help / About buttons cannot load (browsers block ' +
      'reading <code>contents.json</code> over <code>file://</code>). See ' +
      '<code>README.md</code>: serve the <code>html5</code> folder over HTTP and open ' +
      'the <code>http://localhost</code> address instead.';
    document.body.insertBefore(el, document.body.firstChild);
  }

  /* -------------------------------- init ---------------------------------- */
  function init() {
    if (location.protocol === 'file:') showFileProtocolNotice();

    galaxyCanvas = document.getElementById('mw-galaxy');
    riskCanvas   = document.getElementById('mw-risk');
    metalsCanvas = document.getElementById('mw-metals');
    slider       = document.getElementById('mw-dist');
    readout      = document.getElementById('mw-readout');
    liveRegion   = document.getElementById('mw-live');

    galaxyCtx = prepCanvas(galaxyCanvas);
    riskCtx   = prepCanvas(riskCanvas);
    metalsCtx = prepCanvas(metalsCanvas);

    // Load the reused NASA/JPL-Caltech galaxy bitmap (images/33.jpg).
    galaxyImg = new Image();
    galaxyImg.onload = function () { galaxyImgReady = true; render(); };
    galaxyImg.src = 'assets/milkyway.jpg';

    // Accessible slider -> shared radius. Native range gives arrows / Page /
    // Home / End for free; it announces itself via aria-valuetext.
    slider.addEventListener('input', function () {
      setRadius(parseFloat(slider.value), { announce: false });
    });
    // 'change' fires when the slider value is committed (release / keyboard).
    slider.addEventListener('change', typesetReadout);

    attachPlotDrag(riskCanvas);
    attachPlotDrag(metalsCanvas);

    // Position + typeset the axis labels for each plot.
    var plotWraps = document.querySelectorAll('.mw-plot-wrap');
    for (var i = 0; i < plotWraps.length; i++) placeAxisLabels(plotWraps[i]);

    // Reset comes from the shared masthead's bubbling "sim-reset" event.
    document.addEventListener('sim-reset', function () {
      setRadius(INIT_RADIUS, { announce: true });
      typesetReadout();
    });

    setRadius(INIT_RADIUS, { announce: false });   // onReset() initial state
    typesetReadout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
