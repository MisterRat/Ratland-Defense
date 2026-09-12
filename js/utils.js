// Small math/vector helpers shared across modules.

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.hypot(dx, dy);
}

// Move point p toward target by at most `step`; returns remaining distance.
function moveToward(px, py, tx, ty, step) {
  const d = dist(px, py, tx, ty);
  if (d <= step || d === 0) return [tx, ty, 0];
  const t = step / d;
  return [px + (tx - px) * t, py + (ty - py) * t, d - step];
}

// Grid cell from pixel coordinates.
function cellOf(x, y, cell) {
  return { cx: Math.floor(x / cell), cy: Math.floor(y / cell) };
}

// Pixel center of a grid cell.
function cellCenter(cx, cy, cell) {
  return { x: (cx + 0.5) * cell, y: (cy + 0.5) * cell };
}

function formatMoney(n) {
  return '$' + Math.floor(n);
}

// '#rrggbb' + alpha (0..1) -> 'rgba(r,g,b,a)' — for fading effect colors.
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
