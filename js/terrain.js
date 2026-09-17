// Terrain decoration: difficulty-scaled water ponds. Ponds are 4×4-cell blocks
// placed deterministically per (level, effective difficulty) — stable across
// retries and reloads, reshuffled when the player changes difficulty. Water
// cells are unbuildable (game.canPlace) but otherwise cosmetic: enemies walk
// the path, which never overlaps a pond by construction.

const POND_SIZE = 4; // ponds are 4×4 grid cells
const PONDS_BY_DIFFICULTY = { easy: 0, normal: 1, hard: 2, nightmare: 4 };
const POND_MAX_ATTEMPTS = 200; // per-pond rejection-sampling cap (defensive)

// Local copy of the generator's seeded PRNG — levelgen_paths.js is not loaded
// on the game page, so terrain must be self-contained.
function pondRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small string hash (FNV-1a, 32-bit) so the difficulty key mixes into the seed.
function pondHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Build the pond layout for a level at a given difficulty key.
// Returns { cells: Set<'cx,cy'>, rects: [{cx, cy}] } (top-left of each pond).
// Every pond is in-bounds, never overlaps another pond, and never touches a
// path cell. If placement fails after POND_MAX_ATTEMPTS tries (practically
// unreachable on the 28×16 grid), fewer ponds are placed rather than throwing.
function buildPonds(levelIndex, difficultyKey, path) {
  const want = PONDS_BY_DIFFICULTY[difficultyKey] ?? 0;
  const rng = pondRng(((levelIndex + 1) * 0x9E3779B9) ^ pondHash(String(difficultyKey)));
  const cells = new Set();
  const rects = [];
  for (let p = 0; p < want; p++) {
    let placed = false;
    for (let attempt = 0; attempt < POND_MAX_ATTEMPTS && !placed; attempt++) {
      const cx = Math.floor(rng() * (GRID.cols - POND_SIZE + 1));
      const cy = Math.floor(rng() * (GRID.rows - POND_SIZE + 1));
      if (pondCollides(cx, cy, path.cells, cells)) continue;
      rects.push({ cx, cy });
      for (let dy = 0; dy < POND_SIZE; dy++) {
        for (let dx = 0; dx < POND_SIZE; dx++) {
          cells.add(key(cx + dx, cy + dy));
        }
      }
      placed = true;
    }
  }
  return { cells, rects };
}

// True if a POND_SIZE×POND_SIZE block at (cx, cy) overlaps the path or an
// already-placed pond. Out-of-bounds blocks collide too (callers clamp, but
// this keeps the check self-contained).
function pondCollides(cx, cy, pathCells, existingCells) {
  for (let dy = 0; dy < POND_SIZE; dy++) {
    for (let dx = 0; dx < POND_SIZE; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= GRID.cols || y < 0 || y >= GRID.rows) return true;
      const k = key(x, y);
      if (pathCells.has(k) || existingCells.has(k)) return true;
    }
  }
  return false;
}

function isWaterCell(ponds, cx, cy) {
  return !!(ponds && ponds.cells && ponds.cells.has(key(cx, cy)));
}
