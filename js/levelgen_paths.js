// Level generator — path module. Seeded RNG + Bloons/Kingdom-Rush-inspired
// path templates (arc, sbend, loop, weave, crossroads). Templates emit
// axis-aligned control points; the Catmull-Rom spline in js/path.js bows them
// into real curves (corners round, long offsets become arcs). Every candidate
// is validated against the game's own rules (spawn x=-1, exit x=cols, no
// U-turns/double-walks; angled crossovers allowed) and re-rolled on failure.

// mulberry32: small fast seeded PRNG returning floats in [0,1).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helpers bound to a PRNG.
function rngInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function rngShuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Grid bounds from config (rows 0..rows-1, internal x 0..cols-1).
const LG_ROWS = GRID.rows;
const LG_COLS = GRID.cols;

// A path is a list of [x,y] waypoints starting at [-1, row] and ending at [cols, row].
// Segments are axis-aligned or 45° diagonal. Templates return waypoint arrays.

// Arc: run -> one wide offset bend (two corners, far apart) -> run. The
// spline bows the offset into a smooth highway curve. No crossovers.
function tplArc(rng) {
  const rA = rngInt(rng, 1, LG_ROWS - 2);
  const x1 = rngInt(rng, 3, 8);
  let downFirst = rng() < 0.5;
  // Flip direction if it has too little room.
  if (Math.min(downFirst ? LG_ROWS - 2 - rA : rA - 1, LG_COLS - 12 - x1) < 4) downFirst = !downFirst;
  const maxLen = Math.min(downFirst ? LG_ROWS - 2 - rA : rA - 1, LG_COLS - 12 - x1);
  const len = rngInt(rng, Math.min(4, maxLen), maxLen);
  const rB = downFirst ? rA + len : rA - len;
  const x2 = rngInt(rng, x1 + 5, LG_COLS - 3);
  return [[-1, rA], [x1, rA], [x1, rB], [x2, rB], [LG_COLS, rB]];
}

// S-Bend: two opposing offsets (down then back up) — a smooth S through the
// grid. No crossovers.
function tplSBend(rng) {
  const rA = rngInt(rng, 4, LG_ROWS - 5); // room both above and below
  const x1 = rngInt(rng, 3, 7);
  const len1 = rngInt(rng, 3, Math.min(5, LG_ROWS - 2 - rA));
  const rB = rA + len1;
  const mid = rngInt(rng, 4, 8);
  const x2 = x1 + mid;
  const len2 = rngInt(rng, 3, Math.min(rA - 1, LG_COLS - 3 - x2));
  const rC = rB - len2; // back toward the top, never crossing row rA
  const x3 = rngInt(rng, x2 + 4, LG_COLS - 2);
  return [[-1, rA], [x1, rA], [x1, rB], [x2, rB], [x2, rC], [x3, rC], [LG_COLS, rC]];
}

// Loop: run -> down -> right -> up (short) -> left along an offset lane ->
// up through the first run's row (crossover) -> exit. The spline rounds the
// hairpin; the offset lane keeps the double-back from overlapping the first
// run. Crossovers: (x1, rC) where the lane crosses the down column, and
// (xh, rA) where the return crosses the first run.
function tplLoop(rng) {
  const rA = rngInt(rng, 3, LG_ROWS - 7); // room below for the hook AND above for the return
  const x1 = rngInt(rng, 4, 8);
  const len = rngInt(rng, 4, Math.min(6, LG_ROWS - 2 - rA)); // rB stays <= rows-2
  const rB = rA + len;
  const x2 = rngInt(rng, x1 + 5, LG_COLS - 3);
  const rC = rA + rngInt(rng, 1, len - 2); // offset lane row strictly inside the hairpin
  const xh = rngInt(rng, 0, x1 - 1); // return column left of the down column
  const rD = rngInt(rng, 1, rA - 2); // keep the return lane off the top edge row
  return [[-1, rA], [x1, rA], [x1, rB], [x2, rB], [x2, rC], [xh, rC], [xh, rD], [LG_COLS, rD]];
}

// Weave: one left-free hook that crosses the first run (single crossover at (x2, r0)).
function tplWeave(rng) {
  const r0 = rngInt(rng, 3, LG_ROWS - 4);
  const x1 = rngInt(rng, 5, 9);
  const r1 = Math.min(r0 + rngInt(rng, 3, 6), LG_ROWS - 2);
  const x2 = rngInt(rng, x1 + 4, 20);
  const r2 = Math.max(r0 - rngInt(rng, 1, 3), 1); // off the top edge row
  return [[-1, r0], [x1, r0], [x1, r1], [x2, r1], [x2, r2], [LG_COLS, r2]];
}

// Crossroads: two perpendicular crossovers (Bloons style). Mirrors the built-in
// "Crossroads" level's shape with randomized rows/columns.
function tplCrossroads(rng) {
  const rA = rngInt(rng, 3, LG_ROWS - 5);
  const x1 = rngInt(rng, 9, 15);
  const rB = Math.min(rA + rngInt(rng, 4, 6), LG_ROWS - 2);
  const x2 = rngInt(rng, 2, x1 - 4);
  const rC = Math.max(rA - rngInt(rng, 2, 3), 1); // off the top edge row
  const x3 = rngInt(rng, x1 + 2, LG_COLS - 3);
  const rE = Math.min(rB + rngInt(rng, 1, 3), LG_ROWS - 2);
  const rD = rngInt(rng, rC + 2, rE - 2);
  const x4 = rngInt(rng, x3 - 5, x3 - 2);
  return [[-1, rA], [x1, rA], [x1, rB], [x2, rB], [x2, rC],
          [x3, rC], [x3, rE], [x4, rE], [x4, rD], [LG_COLS, rD]];
}

const LG_TEMPLATES = { arc: tplArc, sbend: tplSBend, loop: tplLoop, weave: tplWeave, crossroads: tplCrossroads };

// Stats for a candidate: path length (cells), crossover count, buildable cells.
// Sample-based: the shared walkPathCells walker (spline samples) supplies both
// the cell set and the re-entry sequence, so stats match the rendered curve.
function lgPathStats(waypoints) {
  const walk = walkPathCells(waypoints);
  if (hasSelfIntersection(waypoints)) return null; // never expected: validated below
  const counts = new Map();
  for (const k of walk.seq) counts.set(k, (counts.get(k) || 0) + 1);
  let crossovers = 0;
  for (const n of counts.values()) if (n >= 2) crossovers++;
  let buildable = 0;
  for (let x = 0; x < LG_COLS; x++) for (let y = 0; y < LG_ROWS; y++) {
    if (!walk.cells.has(x + ',' + y)) buildable++;
  }
  return { length: walk.length, crossovers, buildable };
}

// Generate `count` validated path candidates. Each uses a distinct template
// (shuffled) and re-rolls up to maxTries times on validation failure. Each
// candidate carries its own `_seed` (drawn from the master seed) so callers
// can derive stable per-candidate extras — e.g. the silly name in the UI.
function generatePathCandidates(seed, count = 4, maxTries = 12) {
  const rng = mulberry32(seed);
  const names = rngShuffle(rng, Object.keys(LG_TEMPLATES)).slice(0, count);
  const out = [];
  for (const name of names) {
    const cseed = (rng() * 0xFFFFFFFF) >>> 0; // per-candidate seed
    const candRng = mulberry32(cseed);
    let wps = null;
    for (let t = 0; t < maxTries && !wps; t++) {
      const cand = LG_TEMPLATES[name](candRng);
      const v = validateLevelDef({ name: 'tmp', waypoints: cand });
      if (v.ok) wps = cand;
    }
    if (!wps) continue; // exhausted retries (should not happen with these templates)
    out.push({ template: name, waypoints: wps, stats: lgPathStats(wps), _seed: cseed });
  }
  return out;
}
