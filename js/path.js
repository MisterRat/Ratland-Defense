// Path construction: waypoints (grid coords) -> spline-sampled pixel points
// + blocked cells. The path is a Catmull-Rom spline through the waypoint cell
// centers; straight runs stay straight, corners become smooth curves.

const SPLINE_STEP_PX = 5; // max distance between two samples along the curve

// Centripetal Catmull-Rom point for one segment (alpha = 0.5). Collinear
// control points stay exactly on the straight line; corners round inside the
// intended cells (no overshoot, unlike the uniform form).
// u is normalized 0..1 across the segment p1 -> p2.
function crPoint(p0, p1, p2, p3, u) {
  const a = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y)) || 1e-6;
  const b = Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y)) || 1e-6;
  const c = Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y)) || 1e-6;
  const t = a + u * b; // parameter position within [t1, t2] (t0 = 0)
  const A1x = (a - t) / a * p0.x + t / a * p1.x;
  const A1y = (a - t) / a * p0.y + t / a * p1.y;
  const A2x = (a + b - t) / b * p1.x + (t - a) / b * p2.x;
  const A2y = (a + b - t) / b * p1.y + (t - a) / b * p2.y;
  const A3x = (a + b + c - t) / c * p2.x + (t - a - b) / c * p3.x;
  const A3y = (a + b + c - t) / c * p2.y + (t - a - b) / c * p3.y;
  const B1x = (a + b - t) / (a + b) * A1x + t / (a + b) * A2x;
  const B1y = (a + b - t) / (a + b) * A1y + t / (a + b) * A2y;
  const B2x = (a + b + c - t) / (b + c) * A2x + (t - a) / (b + c) * A3x;
  const B2y = (a + b + c - t) / (b + c) * A2y + (t - a) / (b + c) * A3y;
  return { x: (a + b - t) / b * B1x + (t - a) / b * B2x, y: (a + b - t) / b * B1y + (t - a) / b * B2y };
}

// Sample the Catmull-Rom spline through the waypoint cell centers.
// Returns a dense array of {x, y} pixel points (first = start, last = end).
function sampleSpline(waypoints, cell = GRID.cell) {
  const pts = waypoints.map(([cx, cy]) => cellCenter(cx, cy, cell));
  const n = pts.length;
  const out = [pts[0]];
  for (let i = 0; i < n - 1; i++) {
    // Endpoints: reflect the missing neighbor about the endpoint so the
    // spline leaves/arrives along the first/last segment (no degenerate
    // zero-length control span that would blow up the centripetal weights).
    const p1 = pts[i], p2 = pts[i + 1];
    const p0 = i > 0 ? pts[i - 1] : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 = i < n - 2 ? pts[i + 2] : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const steps = Math.max(8, Math.ceil(segLen / SPLINE_STEP_PX));
    for (let s = 1; s <= steps; s++) {
      if (i === n - 2 && s === steps) { out.push(p2); break; } // exact end point
      out.push(crPoint(p0, p1, p2, p3, s / steps));
    }
  }
  return out;
}

function buildPath(waypoints = WAYPOINTS) {
  const points = sampleSpline(waypoints);

  // Mark every grid cell the path crosses, then drop off-grid cells.
  const visible = new Set();
  for (const k of walkPathCells(waypoints).cells) {
    const [cx, cy] = k.split(',').map(Number);
    if (cx >= 0 && cx < GRID.cols && cy >= 0 && cy < GRID.rows) visible.add(k);
  }

  // Cumulative distance at each point (for movement + "progress" targeting).
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }

  return { points, cells: visible, cum, total: cum[cum.length - 1] };
}

function key(cx, cy) {
  return cx + ',' + cy;
}

// Walk the path in order, returning the list of grid cells it crosses
// (including off-screen ones). Sample-based: every spline sample marks the
// cell it falls in, so curved paths block exactly the cells the curve covers.
function walkPathCells(waypoints) {
  const seq = []; // cell-walk order; a cell re-entered later appears again
  const seen = new Set();
  for (const p of sampleSpline(waypoints)) {
    const k = key(Math.floor(p.x / GRID.cell), Math.floor(p.y / GRID.cell));
    if (!seen.has(k)) seen.add(k);
    if (seq[seq.length - 1] !== k) seq.push(k); // collapse consecutive repeats
  }
  return { cells: seen, length: seen.size, seq };
}

// Geometric segment intersection (proper crossing only; shared endpoints don't count).
function segsIntersect(a, b, c, d) {
  const cross = (o, p, q) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a), d2 = cross(c, d, b);
  const d3 = cross(a, b, c), d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

// True if the path re-walks itself: two consecutive cells are each entered
// twice in (nearly) the same direction — a U-turn / double-back lane. Rounded
// corners may dip one cell sideways and re-enter (single-cell wiggle); that is
// not a self-intersection. Crossing a cell twice in different directions is a
// crossover and is allowed.
function hasSelfIntersection(waypoints) {
  const pts = sampleSpline(waypoints);
  // Each maximal run of samples inside one cell -> one visit: direction + the
  // next cell key (in walk order).
  const visits = new Map(); // cell key -> [{dx, dy, next}, ...]
  let i = 0;
  while (i < pts.length) {
    const k = key(Math.floor(pts[i].x / GRID.cell), Math.floor(pts[i].y / GRID.cell));
    let j = i;
    while (j + 1 < pts.length &&
           key(Math.floor(pts[j + 1].x / GRID.cell), Math.floor(pts[j + 1].y / GRID.cell)) === k) j++;
    const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
    if (dx !== 0 || dy !== 0) {
      const next = j + 1 < pts.length
        ? key(Math.floor(pts[j + 1].x / GRID.cell), Math.floor(pts[j + 1].y / GRID.cell)) : null;
      if (!visits.has(k)) visits.set(k, []);
      visits.get(k).push({ dx, dy, next });
    }
    i = j + 1;
  }
  const sameDir = (a, b) => {
    const la = Math.hypot(a.dx, a.dy) || 1, lb = Math.hypot(b.dx, b.dy) || 1;
    return (a.dx * b.dx + a.dy * b.dy) / (la * lb) > 0.9;
  };
  for (const list of visits.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        if (sameDir(list[a], list[b]) && list[a].next !== null && list[a].next === list[b].next) {
          return true; // two consecutive cells double-walked: real overlap
        }
      }
    }
  }
  return false;
}

// Position on the path at distance `d` from the start. Returns null past the end.
function pointAtDistance(path, d) {
  if (d >= path.total) return null;
  for (let i = 1; i < path.points.length; i++) {
    if (path.cum[i] >= d) {
      const segLen = path.cum[i] - path.cum[i - 1];
      const t = segLen === 0 ? 0 : (d - path.cum[i - 1]) / segLen;
      const a = path.points[i - 1], b = path.points[i];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return null;
}

function isPathCell(path, cx, cy) {
  return path.cells.has(key(cx, cy));
}
