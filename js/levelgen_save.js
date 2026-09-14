// Level generator — save flow for "Create". Builds pure-data JSON defs for the
// checked candidates (each stamped with a unique 128-bit v4 UUID — the level's
// machine identity; the silly name is for humans) and saves them straight to
// the localStorage custom-level store, registering them in memory. No files
// are written: Export (levelgen_ui.js) is how levels leave this browser — as a
// .json backup/share file in the same schema the levels/ folder uses.

// Pure-data def for a candidate (matches the levels/*.json schema). The uuid
// is generated here — it is the dedupe key when levels are shared between
// users; it is internal and never shown in the UI. Phase 29: `towers` is the
// checked tower roster (always written — even the full list, so the export
// records intent; absent = all towers allowed, which is what older levels get).
function lgBuildDef(candidate, opts) {
  const def = {
    name: (candidate._name || opts.name).trim(),
    uuid: lgUuid(),
    waypoints: candidate.waypoints,
    startMoney: opts.startMoney,
    totalWaves: opts.waves,
    difficulty: LG_DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal',
    waves: buildGeneratedWaves({ enemies: opts.enemies, difficulty: opts.difficulty, waves: opts.waves }),
  };
  if (Array.isArray(opts.towers) && opts.towers.length) def.towers = opts.towers;
  return def;
}

// Create all checked candidates. Saves each def to the localStorage store and
// registers it in memory (playable immediately, no file involved). Returns
// per-level results: [{ def, registered }] — registered is the registry level
// or null.
function lgCreateLevels(candidates, opts) {
  const results = [];
  for (const cand of candidates) {
    const def = lgBuildDef(cand, opts);
    saveCustomLevel(def);
    const registered = registerLevel(def, 'custom:' + def.uuid);
    if (registered) registered.custom = true;
    results.push({ def, registered });
  }
  return results;
}
