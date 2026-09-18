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
    const s = Math.min(1, vw / body.scrollWidth, vh / body.scrollHeight);
    const next = s < 0.999 ? `scale(${s})` : '';
    if (body.style.transform !== next) body.style.transform = next;
  }

  body.style.transformOrigin = 'top center';
  fit();
  window.addEventListener('resize', fit);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(body);
})();
