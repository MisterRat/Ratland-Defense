// Build js/levels_external.js from the pure-data .json files in levels/.
//
// Usage:  node tools/build_levels.mjs [levelsDir] [outFile]
//         (defaults: levels/ and js/levels_external.js)
//
// The .json files are the shareable artifact. Security: each file must parse
// as JSON, pass the game's own validateLevelDef (which includes a pure-data
// gate — only null/string/number/boolean/array/plain-object values), and is
// re-serialized with JSON.stringify into a data-only classic script, so a
// malicious .json can never inject code into the generated file (string
// contents are fully escaped; the wrapper is a fixed literal + loop). Every
// entry is validated AGAIN at game boot by the generated file's inline glue.
//
// On any validation error: prints all problems and exits 1 WITHOUT writing
// the output file (atomic — a bad file never produces half-built output, and
// no .json is mutated either).
//
// UUIDs: each level's `uuid` (v4) is its identity for dedupe when levels are
// shared between users. A file missing one gets a fresh uuid written back to
// the .json AFTER the whole directory validates (a failing build never
// mutates files); two files sharing a uuid fail the build.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import process from 'node:process';

const levelsDir = resolve(process.argv[2] || 'levels');
const outFile = resolve(process.argv[3] || 'js/levels_external.js');
const MAX_BYTES = 1024 * 1024; // 1 MB cap per file (same as the runtime guard)

// --- Load the game's own validator so build-time and runtime rules match ----
// All parsing/validation happens INSIDE the vm realm: checkPureData compares
// prototypes, which only match for objects created in the same realm.
const sandbox = { console };
vm.createContext(sandbox);
for (const f of ['js/config.js', 'js/utils.js', 'js/path.js', 'js/level_validate.js']) {
  vm.runInContext(readFileSync(f, 'utf8'), sandbox, { filename: f });
}
// Validate one file's raw text inside the realm. Returns { ok, def?, problems? }.
function validateText(text) {
  return vm.runInContext(`(function (t) {
    let def;
    try { def = JSON.parse(t); } catch (e) { return { ok: false, problems: ['not valid JSON (' + e.message + ')'] }; }
    if (!def || typeof def !== 'object' || Array.isArray(def)) {
      return { ok: false, problems: ['top level must be a JSON object'] };
    }
    const v = validateLevelDef(def);
    return v.ok ? { ok: true, def } : { ok: false, problems: v.problems };
  })`, sandbox)(text);
}

// --- Collect and validate every .json in the directory --------------------
// The uuid is each level's identity (dedupe key when levels are shared
// between users). Files missing one get a fresh v4 uuid written back into
// their .json file — only the uuid field is added, everything else is kept
// byte-for-byte by JSON round-trip. Two files sharing a uuid = build error.
// Play order: easier difficulty first (easy < normal < hard < nightmare),
// then alphabetically by name — players meet the easier external levels
// before the hard ones. (Alphabetical filename is only the read order.)
const DIFFICULTY_RANK = { easy: 0, normal: 1, hard: 2, nightmare: 3 }; // mirrors DIFFICULTY_KEYS
const names = readdirSync(levelsDir).filter(n => n.endsWith('.json')).sort();
const errors = [];
const levels = [];
const uuidAdds = []; // files that need a uuid written back (done after ALL
                     // validation passes — a failing build must not mutate files)
for (const name of names) {
  const path = join(levelsDir, name);
  const text = readFileSync(path, 'utf8');
  if (text.length > MAX_BYTES) { errors.push(`${name}: file too large (>1 MB)`); continue; }
  const r = validateText(text);
  if (!r.ok) { errors.push(`${name}: ${r.problems.join('; ')}`); continue; }
  if (!r.def.uuid) {
    r.def.uuid = crypto.randomUUID(); // v4, lowercase — matches the validator
    uuidAdds.push({ path, def: r.def });
  }
  if (levels.some(l => l.def.uuid === r.def.uuid)) {
    errors.push(`${name}: duplicate level uuid "${r.def.uuid}" (same level as ${levels.find(l => l.def.uuid === r.def.uuid).source})`);
    continue;
  }
  if (levels.some(l => l.def.name === r.def.name)) {
    errors.push(`${name}: duplicate level name "${r.def.name}"`);
    continue;
  }
  levels.push({ def: r.def, source: name });
}

// All files validated: order them by difficulty, then name. A missing
// difficulty means 'normal' (same default the runtime glue applies).
levels.sort((a, b) => {
  const ra = DIFFICULTY_RANK[a.def.difficulty || 'normal'];
  const rb = DIFFICULTY_RANK[b.def.difficulty || 'normal'];
  return ra !== rb ? ra - rb : a.def.name.localeCompare(b.def.name);
});

if (errors.length) {
  console.error('build_levels: FAILED — output not written:');
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

// All files validated: now persist the auto-added uuids back into their
// .json files (only the uuid field is added; JSON round-trip keeps the rest).
for (const add of uuidAdds) {
  writeFileSync(add.path, JSON.stringify(add.def, null, 2) + '\n', 'utf8');
  console.log(`${basename(add.path)}: no uuid — added ${add.def.uuid} to the file`);
}

// --- Emit the self-contained data-only classic script -----------------------
// The registration glue is INLINED (it does not call the game's registerLevel):
// this file loads BEFORE js/path.js, which defines hasSelfIntersection — a
// function validateLevelDef needs. The validator and registry are already
// loaded at that point (index.html order), so this only duplicates ~20 lines
// of glue, mirroring normalizeLevelDef/registerLevel in js/level_registry.js.
const entries = levels.map(l => JSON.stringify({ ...l.def, _source: l.source }, null, 2));
const out = [
  '// AUTO-GENERATED by tools/build_levels.mjs from levels/*.json — do not edit.',
  `// Source of truth: the .json files in levels/ (re-run: node tools/build_levels.mjs).`,
  '// Data only: JSON.stringify output + a fixed registration loop. No level',
  '// content can execute code; every entry is re-validated at boot.',
  '// Play order: easier difficulty first (easy < normal < hard < nightmare),',
  '// then alphabetically by name. All external levels are added unlocked —',
  '// progress.js uses EXTERNAL_COUNT to keep them outside the win-gate.',
  `var EXTERNAL_COUNT = ${levels.length};`,
  'var LEVELS_EXTERNAL = [',
  entries.join(',\n'),
  '];',
  '(function () {',
  '  if (typeof validateLevelDef !== "function" || typeof _levels === "undefined") return;',
  '  for (var i = 0; i < LEVELS_EXTERNAL.length; i++) {',
  '    var def = LEVELS_EXTERNAL[i];',
  '    var v = validateLevelDef(def);',
  '    if (!v.ok) {',
  '      console.warn("[levels] rejected " + def._source + ": " + v.problems.join("; "));',
  '      continue;',
  '    }',
  '    _levels.push({',
  '      name: def.name.trim(),',
  '      waypoints: def.waypoints,',
  '      startMoney: def.startMoney !== undefined ? def.startMoney : levelStartMoney(_levels.length),',
  '      totalWaves: def.totalWaves !== undefined ? def.totalWaves : TOTAL_WAVES,',
  '      waves: def.waves || null,',
  '      ...(def.towers ? { towers: def.towers } : {}), // roster restriction (absent = all allowed)',
  '      difficulty: def.difficulty || "normal",',
  '      uuid: def.uuid,',
  '      source: def._source',
  '    });',
  '  }',
  '})();',
  '',
].join('\n');

writeFileSync(outFile, out, 'utf8');
console.log(`build_levels: wrote ${basename(outFile)} — ${levels.length} level(s): ` +
  levels.map(l => `${l.def.name} (${l.source})`).join(', ') || 'none');
