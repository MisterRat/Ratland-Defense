// Custom-level store: localStorage mirror for levels created on the level
// generator page. Both index.html and levelgen.html load this after
// level_registry.js; at boot it re-registers every saved def (validated,
// deduped by UUID against the registry — legacy defs without a uuid fall
// back to name) so created levels survive reloads and appear in the main
// dropdown. The uuid is the level's identity for code; the name is cosmetic.

const CUSTOM_LEVELS_KEY = 'towerDefenseCustomLevels.v1';

// Identity of a stored def: its uuid, or its name for legacy pre-uuid defs.
function customLevelId(def) {
  return def.uuid || ('name:' + def.name);
}

// Does the registry already contain this level (same uuid, or same name for
// uuid-less legacy defs)?
function registryHasLevel(def) {
  if (def.uuid) return getLevels().some(l => l.uuid === def.uuid);
  return getLevels().some(l => !l.uuid && l.name === def.name);
}

// Read all saved custom level defs (pure data). Returns [] on any failure.
function getCustomLevels() {
  let data = null;
  try {
    const raw = localStorage.getItem(CUSTOM_LEVELS_KEY);
    if (raw) data = JSON.parse(raw);
  } catch (err) { return []; }
  if (!Array.isArray(data)) return [];
  return data.filter(d => d && typeof d === 'object');
}

// Persist one created level def (replaces an existing entry with the same
// uuid — re-creating a level updates it instead of duplicating it).
function saveCustomLevel(def) {
  const id = customLevelId(def);
  const list = getCustomLevels().filter(d => customLevelId(d) !== id);
  list.push(def);
  try {
    localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(list));
  } catch (err) { /* non-persistent session; in-memory registration still works */ }
}

// Boot-time registration: validate + register each saved def, skipping levels
// already in the registry by uuid (a later build of levels_external.js must
// never double-register). Returns the number of levels registered.
function registerCustomLevels() {
  let n = 0;
  for (const def of getCustomLevels()) {
    if (!def || typeof def.name !== 'string') continue;
    if (registryHasLevel(def)) continue; // already registered (uuid or legacy name)
    const lvl = registerLevel(def, 'custom:' + def.name);
    if (lvl) { lvl.custom = true; n++; }
  }
  return n;
}

// Mark every custom level in the registry (used by UI to show a badge).
function isCustomLevel(i) {
  const l = getLevel(i);
  return !!(l && l.custom);
}

// Auto-register at load time. Both pages load this script after the registry
// and external levels, so saved custom levels join the registry before the UI
// builds its dropdown. No-op when storage is empty or unavailable.
if (typeof registerLevel === 'function' && typeof getLevels === 'function') {
  registerCustomLevels();
}
