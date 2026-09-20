// Phase 53: windowed-mode fit — scale the whole game page DOWN (never up) so
// the fixed ~1844×900 layout fits any smaller browser window with no
// scrollbars. The canvas keeps its native 1400×800 backing store; input.js
// already maps clicks through getBoundingClientRect ratios, so hover/placement
// accuracy is scale-independent.
//
// How it works: a CSS transform on document.body (transform-origin top center)
// shrinks the rendered layout without changing layout sizes — scrollWidth/
// scrollHeight are transform-invariant, so there is no feedback loop. A
// transformed ancestor also becomes the containing block for position:fixed
// elements, which is exactly what we want: the tutorial card (fixed to the
// viewport) scales along with everything else.
//
// Phase 65 — width measurement: the body is a CENTERED flex column
// (align-items:center). When its content is wider than the viewport, half of
// the overflow sticks out to the LEFT of the viewport edge — and leftward
// overflow does NOT grow scrollWidth (only rightward overflow does). Measuring
// scrollWidth alone would therefore under-report the width and scale only for
// the height, letting the side columns run off screen on horizontal resizes.
// body.clientWidth is no help either: the body itself stays viewport-wide and
// its children overflow it symmetrically. The true layout width is the widest
// child's offsetWidth — offsetWidth reports the untransformed layout size, so
// it is stable across rescales (no feedback loop) and independent of where
// the overflow sits. scrollWidth is kept as a floor for anything wider than a
// single child.
//
// Re-fits on window resize AND when body content size changes (the tower panel
// growing the row), via ResizeObserver when available. Headless-safe: the vm
// smoke stubs have no documentElement client sizes, so the guard bails out and
// boots untouched.
(function () {
  // Headless-safe: no-ops in vm sandboxes that have no DOM (smoke_boot.mjs
  // loads every script minus main.js with a bare sandbox).
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const body = document.body;
  const de = document.documentElement;
  if (!body || !de) return; // vm stubs without client sizes

  function fit() {
    const vw = de.clientWidth, vh = de.clientHeight;
    if (!Number.isFinite(vw) || !Number.isFinite(vh) || vw <= 0 || vh <= 0) return;
    // True layout width — see the Phase 65 note above: scrollWidth alone misses
    // the leftward overflow of a centered flex column in a narrow viewport.
    let w = Number.isFinite(body.scrollWidth) ? body.scrollWidth : 0;
    for (const c of body.children) {
      const cw = c && Number.isFinite(c.offsetWidth) ? c.offsetWidth : 0;
      if (cw > w) w = cw;
    }
    if (!(w > 0)) return; // headless stubs with no measurable width
    const s = Math.min(1, vw / w, vh / body.scrollHeight);
    const next = s < 0.999 ? `scale(${s})` : '';
    if (body.style.transform !== next) body.style.transform = next;
  }

  body.style.transformOrigin = 'top center';
  fit();
  window.addEventListener('resize', fit);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(body);
})();
