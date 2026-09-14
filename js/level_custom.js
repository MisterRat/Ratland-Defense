// Custom-level store: localStorage is the single source of truth for every
// non-built-in level — levels created on the generator page and levels
// imported from .json files (the levels/ folder format or a friend's export).
// Both index.html and levelgen.html load this after level_registry.js; at boot
// it re-registers every saved def (validated, deduped by UUID against the
// registry — legacy defs without a uuid fall back to name) so created/imported
// levels survive reloads and appear in the main dropdown. The uuid is the
// level's identity for code; the name is cosmetic.

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

// Fallback v4 UUID for bundles that don't load js/levelgen_names.js (index.html
// never does). Browsers with crypto.getRandomValues get real randomness.
function customUuid() {
  if (typeof lgUuid === 'function') return lgUuid();
  const bytes = new Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const h = [];
  for (let i = 0; i < 16; i++) h.push((bytes[i] + 0x100).toString(16).slice(-2));
  return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
    h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' +
    h.slice(10, 16).join('');
}

// Import level defs from .json files: an array of defs (an export file or a
// batch of levels/ files) or a single def object. Each entry is validated with
// the game's own validator; entries missing a uuid get a fresh v4 stamped in;
// duplicates (same uuid already in the store or registry) are skipped — the
// existing level wins. Valid new entries are persisted to localStorage and
// registered in memory. Returns { added, skipped, problems }.
function importLevelDefs(defs) {
  const result = { added: 0, skipped: 0, problems: [] };
  if (!defs || typeof defs !== 'object') return result;
  const arr = Array.isArray(defs) ? defs : [defs];
  const list = getCustomLevels();
  const seen = new Set(list.map(customLevelId));
  let changed = false;
  for (let i = 0; i < arr.length; i++) {
    const raw = arr[i];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      result.skipped++;
      result.problems.push(`entry ${i + 1}: not a level object`);
      continue;
    }
    const v = validateLevelDef(raw);
    if (!v.ok) {
      result.skipped++;
      result.problems.push(`entry ${i + 1} "${raw.name || '?'}": ${v.problems.join('; ')}`);
      continue;
    }
    const def = Object.assign({}, raw);
    if (!def.uuid) {
      // No uuid (raw levels/ file): identity is its name, like legacy defs —
      // re-importing the same file dedupes by name (even against an earlier
      // import of it that was stamped with a uuid). Stamp a fresh uuid only
      // for genuinely new levels so the stored entry carries one from then on.
      const id = 'name:' + def.name;
      if (seen.has(id) || registryHasLevel(def) || list.some(d => d.name === def.name)) {
        result.skipped++; continue; // existing wins
      }
      seen.add(id);
      def.uuid = customUuid();
    } else {
      const id = customLevelId(def);
      if (seen.has(id) || registryHasLevel(def)) { result.skipped++; continue; } // existing wins
      seen.add(id);
    }
    list.push(def);
    result.added++;
    changed = true;
  }
  if (changed) {
    try { localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(list)); } catch (err) { /* non-persistent */ }
    registerCustomLevels(); // persist + register the new entries in memory
  }
  return result;
}

// The whole store as a pretty-printed JSON array — the backup/share format.
// A friend's export file (or single-level files from the levels/ folder)
// imports back through importLevelDefs.
function exportCustomLevels() {
  return JSON.stringify(getCustomLevels(), null, 2);
}

// Filename for a single-level export: sanitized name + .json (e.g.
// "Soggy_Walrus.json"). No level number — ordering is not the store's job.
function lgFilename(name) {
  const safe = String(name).trim().replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'level';
  return safe + '.json';
}

// Match a stored def by `id`: the level's uuid, its full store id
// (customLevelId — 'name:<name>' for legacy uuid-less defs), or its bare name.
function findCustomLevel(id) {
  return getCustomLevels().find(d => customLevelId(d) === id || d.name === id);
}

// One stored level as a pretty-printed JSON object (single-file export).
// Returns null when no stored level matches.
function exportLevelDef(id) {
  const def = findCustomLevel(id);
  return def ? JSON.stringify(def, null, 2) : null;
}

// Delete one stored level by uuid (or name for legacy uuid-less defs):
// removes it from the store AND unregisters it from the in-memory registry.
// Returns the removed def, or null when nothing matched.
function deleteCustomLevel(id) {
  const list = getCustomLevels();
  const i = list.findIndex(d => customLevelId(d) === id || d.name === id);
  if (i < 0) return null;
  const [def] = list.splice(i, 1);
  try { localStorage.setItem(CUSTOM_LEVELS_KEY, JSON.stringify(list)); } catch (err) { /* non-persistent */ }
  // Unregister from the live registry (getLevels() returns the _levels array).
  const levels = getLevels();
  const j = levels.findIndex(l => l.uuid ? l.uuid === def.uuid : !l.uuid && l.name === def.name);
  if (j >= 0) levels.splice(j, 1);
  return def;
}

// Boot-time registration: validate + register each saved def, skipping levels
// already in the registry by uuid (a later import must never double-register).
// Returns the number of levels registered.
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

// Auto-register at load time. Both pages load this script after the registry,
// so saved custom levels join the registry before the UI builds its dropdown.
// No-op when storage is empty or unavailable.
if (typeof registerLevel === 'function' && typeof getLevels === 'function') {
  registerCustomLevels();
}
