// Level registry: the single ordered list of all playable levels.
// Built-in levels (js/levels.js) are seeded first; external levels come from
// js/levels_external.js — a generated data-only script (built from the pure
// .json files in levels/ by tools/build_levels.mjs) whose inline glue pushes
// validated defs onto _levels at boot (it loads after path.js, so it can run
// validateLevelDef). The combined list drives the dropdown, levelIndex, unlock
// progression, best scores and auto-advance.

const _levels = [];   // normalized level defs, combined order

// Fill defaults so the rest of the game sees one uniform shape:
// { name, waypoints, startMoney, totalWaves, waves (null = procedural),
//   difficulty (easy/normal/hard/nightmare — drives procedural wave scaling),
//   uuid? (128-bit v4 — the level's identity for code/dedupe; names are for
//         humans and may repeat) }
function normalizeLevelDef(def, index) {
  return {
    name: def.name.trim(),
    waypoints: def.waypoints,
    startMoney: def.startMoney !== undefined ? def.startMoney : levelStartMoney(index),
    totalWaves: def.totalWaves !== undefined ? def.totalWaves : TOTAL_WAVES,
    waves: def.waves || null,
    difficulty: def.difficulty || 'normal',
    ...(def.uuid ? { uuid: def.uuid } : {}), // machine identity (dedupe key)
    ...(def.custom ? { custom: true } : {}), // created on the level generator page
  };
}

// Register an external level. Validates first; on failure logs the problems
// and returns null (a broken file must never break built-in levels).
// sourceFile (optional) is the level's filename, kept for display/debugging.
function registerLevel(def, sourceFile) {
  const { ok, problems } = validateLevelDef(def);
  if (!ok) {
    console.warn('[levels] rejected' + (sourceFile ? ' ' + sourceFile : '') + ': ' + problems.join('; '));
    return null;
  }
  const index = _levels.length;
  const lvl = normalizeLevelDef(def, index);
  if (sourceFile) lvl.source = sourceFile;
  // The UUID is the identity: a second registration with the same uuid is a
  // duplicate import of one shared level. Names are for humans and may repeat.
  if (lvl.uuid && _levels.some(l => l.uuid === lvl.uuid)) {
    console.warn('[levels] duplicate level uuid "' + lvl.uuid + '" (index ' + index + ')');
  }
  _levels.push(lvl);
  return lvl;
}

// Seed the registry from the built-in LEVELS (indices 0..5, unchanged values).
for (let i = 0; i < LEVELS.length; i++) {
  _levels.push(normalizeLevelDef(LEVELS[i], i));
}

function getLevels() {
  return _levels;
}

function getLevel(i) {
  return _levels[i] || null;
}

function levelCount() {
  return _levels.length;
}
