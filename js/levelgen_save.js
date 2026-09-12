// Level generator — save flow for "Create". Builds pure-data JSON defs for the
// checked candidates (each stamped with a unique 128-bit v4 UUID — the level's
// machine identity; the silly name is for humans), names files after the
// sanitized name with NO level number (ordering is not the generator's job),
// saves each via the File System Access API (showSaveFilePicker) with a
// Blob-download fallback, then mirrors to localStorage and registers in memory.

// Filename: sanitized silly name + .json, e.g. "Soggy_Walrus.json".
// No NN_ prefix — the generator must not order levels; play order is just
// plain filename sort on the build side.
function lgFilename(name) {
  const safe = String(name).trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'level';
  return safe + '.json';
}

// Pure-data def for a candidate (matches the levels/*.json schema). The uuid
// is generated here — it is the dedupe key when levels are shared between
// users; it is internal and never shown in the UI. Phase 29: `towers` is the
// checked tower roster (always written — even the full list, so the file
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

// Save one file: File System Access API first, Blob download fallback.
// Returns { mode: 'fsa' | 'download', name } or null on failure.
async function lgSaveFile(def, filename) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Tower Defense level', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' }));
      await writable.close();
      return { mode: 'fsa', name: filename };
    } catch (err) {
      if (err && err.name === 'AbortError') return null; // user cancelled the picker
      // fall through to download
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { mode: 'download', name: filename };
  } catch (err) {
    return null;
  }
}

// Create all checked candidates. Returns per-level results:
// [{ def, filename, registered, save }] — registered is the registry level or null.
async function lgCreateLevels(candidates, opts) {
  const results = [];
  for (const cand of candidates) {
    const def = lgBuildDef(cand, opts);
    const filename = lgFilename(def.name);
    const save = await lgSaveFile(def, filename);
    // Mirror + register regardless of save outcome (in-memory is always safe).
    saveCustomLevel(def);
    const registered = registerLevel(def, 'custom:' + def.uuid);
    if (registered) registered.custom = true;
    results.push({ def, filename, save, registered });
  }
  return results;
}
