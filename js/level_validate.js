// Pure level validation: no game state, no DOM. Shared by the registry
// (console warnings on bad external files), tools/build_levels.mjs and smoke
// tests. validateLevelDef(def) -> { ok: boolean, problems: string[] }

const isInt = v => Number.isInteger(v);

// --- Security gate: pure-data check -----------------------------------------
// A level def must be PURE DATA: null, strings, finite numbers, booleans,
// arrays and plain objects only — nothing else, nested no deeper than
// MAX_DEPTH (deep-nesting DoS guard). JSON.parse output always passes; this
// catches hand-built or tampered defs that smuggle in objects with behavior
// (Dates, prototypes, functions via non-plain wrappers).
const MAX_DEPTH = 64;

function isPlainObject(v) {
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

function checkPureData(value, depth, path, problems) {
  if (depth > MAX_DEPTH) { problems.push(path + ': nesting deeper than ' + MAX_DEPTH); return; }
  const t = typeof value;
  if (value === null || t === 'string' || t === 'boolean') return;
  if (t === 'number') {
    if (!Number.isFinite(value)) problems.push(path + ': non-finite number');
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) checkPureData(value[i], depth + 1, path + '[' + i + ']', problems);
    return;
  }
  if (t === 'object' && isPlainObject(value)) {
    for (const k of Object.keys(value)) checkPureData(value[k], depth + 1, path + '.' + k, problems);
    return;
  }
  problems.push(path + ': not pure data (type ' + t + ')');
}

// Waypoint rules (same as built-in levels, plus arbitrary curves):
//  - >=2 points, each [x, y] with integer coords
//  - spawn at x=-1, exit at x=GRID.cols
//  - rows within 0..rows-1; internal x within 0..cols-1 (spawn/exit exempt)
//  - zero-length segments are rejected; any other segment shape is allowed
//    (the path is a Catmull-Rom spline through the waypoints)
//  - no geometric self-overlap of the sampled spline (clean angled
//    crossovers that stay on separate cells pass)
//  - the sampled spline stays inside the grid rect (one cell of slack on the
//    left/right for the off-screen spawn/exit centers); corners must not bow
//    outside the canvas
function validateWaypoints(wps, problems) {
  if (!Array.isArray(wps) || wps.length < 2) {
    problems.push('waypoints: need an array of at least 2 points');
    return;
  }
  for (let i = 0; i < wps.length; i++) {
    const p = wps[i];
    if (!Array.isArray(p) || p.length !== 2 || !isInt(p[0]) || !isInt(p[1])) {
      problems.push(`waypoints[${i}]: expected [intX, intY]`);
      return;
    }
  }
  const [sx, sy] = wps[0];
  const ex = wps[wps.length - 1][0];
  if (sx !== -1) problems.push(`waypoints[0]: spawn must be at x=-1 (got ${sx})`);
  if (ex !== GRID.cols) problems.push(`waypoints[${wps.length - 1}]: exit must be at x=${GRID.cols} (got ${ex})`);
  for (let i = 0; i < wps.length; i++) {
    const [x, y] = wps[i];
    if (y < 0 || y >= GRID.rows) problems.push(`waypoints[${i}]: row ${y} outside 0..${GRID.rows - 1}`);
    if (i > 0 && i < wps.length - 1 && (x < 0 || x >= GRID.cols)) {
      problems.push(`waypoints[${i}]: internal x ${x} outside 0..${GRID.cols - 1}`);
    }
  }
  for (let i = 1; i < wps.length; i++) {
    const [ax, ay] = wps[i - 1], [bx, by] = wps[i];
    if (ax === bx && ay === by) problems.push(`waypoints[${i}]: zero-length segment`);
  }
  // Reuse the game's own self-intersection check (path.js): geometric overlap
  // of the sampled spline is rejected; clean angled crossovers pass.
  if (hasSelfIntersection(wps)) problems.push('waypoints: self-intersection / U-turn / loop');
  // The spline can bow past the waypoint cells at corners; reject paths whose
  // sampled curve leaves the grid. One cell of x-slack covers the off-screen
  // spawn/exit centers (x=-1 / x=cols); y must stay strictly inside.
  const W = GRID.cols * GRID.cell, H = GRID.rows * GRID.cell;
  for (const p of sampleSpline(wps)) {
    if (p.x < -GRID.cell || p.x > W + GRID.cell || p.y < 0 || p.y >= H) {
      problems.push('waypoints: spline leaves the grid');
      break;
    }
  }
}

// Optional fields: type + range checks only (semantics are the game's job).
// Difficulty keys mirror LG_DIFFICULTY in js/levelgen_waves.js (kept as a
// literal list so this file stays dependency-free for the build tool's vm).
const DIFFICULTY_KEYS = ['easy', 'normal', 'hard', 'nightmare'];

// UUID (v4) pattern: the level's machine identity for dedupe across users.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function validateOptionalFields(def, problems) {
  if (def.uuid !== undefined && (typeof def.uuid !== 'string' || !UUID_RE.test(def.uuid))) {
    problems.push('uuid: must be a lowercase v4 UUID string');
  }
  if (def.startMoney !== undefined && (!isInt(def.startMoney) || def.startMoney < 0)) {
    problems.push('startMoney: must be a non-negative integer');
  }
  if (def.difficulty !== undefined && !DIFFICULTY_KEYS.includes(def.difficulty)) {
    problems.push('difficulty: must be one of ' + DIFFICULTY_KEYS.join(', '));
  }
  if (def.totalWaves !== undefined && (!isInt(def.totalWaves) || def.totalWaves < 1)) {
    problems.push('totalWaves: must be an integer >= 1');
  }
  if (def.waves !== undefined) {
    if (!Array.isArray(def.waves)) {
      problems.push('waves: must be an array of per-wave enemy lists');
    } else {
      for (let w = 0; w < def.waves.length; w++) {
        const list = def.waves[w];
        if (!Array.isArray(list) || !list.every(k => typeof k === 'string')) {
          problems.push(`waves[${w}]: must be an array of enemy type keys`);
        }
      }
    }
  }
}

// Full def: name + waypoints required; optional fields checked if present.
function validateLevelDef(def) {
  const problems = [];
  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    return { ok: false, problems: ['level def must be an object'] };
  }
  // Security first: reject anything that is not pure data before any field
  // check touches the value (a hostile prototype could misbehave in readers).
  checkPureData(def, 0, 'def', problems);
  if (problems.length) return { ok: false, problems };
  if (typeof def.name !== 'string' || !def.name.trim()) {
    problems.push('name: required non-empty string');
  }
  validateWaypoints(def.waypoints, problems);
  validateOptionalFields(def, problems);
  return { ok: problems.length === 0, problems };
}
