// Stored Levels page logic (js/levels.html): lists every level in the
// localStorage custom-level store with per-level actions — Export (single
// .json file, named after the level) and Delete (removes it from the store
// AND the live registry) — plus whole-store management: Import (.json files:
// an export file or individual level files, validated + deduped by uuid) and
// Export All (the whole store as one .json backup/share file). The generator
// page only creates levels; all management lives here.

// Draw the level's path as a small inline diagram (same style as the
// generator's preview cards, at 6px per cell). Falls back gracefully when
// the stored def has no waypoints.
function lsDrawMiniMap(canvas, waypoints) {
  const ctx = canvas.getContext('2d');
  const S = 6; // px per grid cell
  canvas.width = GRID.cols * S;
  canvas.height = GRID.rows * S;
  ctx.fillStyle = '#1d232c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!Array.isArray(waypoints) || waypoints.length < 2) return;
  // Path line: the actual spline, sampled at diagram scale.
  ctx.strokeStyle = '#4fa3ff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  sampleSpline(waypoints, S).forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  // Spawn marker (green at left edge) and exit marker (red at right).
  const [sx, sy] = waypoints[0];
  const [ex, ey] = waypoints[waypoints.length - 1];
  ctx.fillStyle = '#3ddc84';
  ctx.fillRect(0, (sy + 0.5) * S - 3, 5, 6);
  ctx.fillStyle = '#ff5da2';
  ctx.fillRect(canvas.width - 5, (ey + 0.5) * S - 3, 5, 6);
}

// Render one row per stored level: mini-map + name + meta + uuid short form + buttons.
function lsRender() {
  const wrap = document.getElementById('lsList');
  const count = document.getElementById('lsCount');
  const levels = getCustomLevels();
  count.textContent = levels.length;
  wrap.innerHTML = '';
  if (!levels.length) {
    const empty = document.createElement('div');
    empty.className = 'ls-empty';
    empty.textContent = 'No stored levels yet — create some on the generator page or import a .json file.';
    wrap.appendChild(empty);
    return;
  }
  for (const def of levels) {
    const row = document.createElement('div');
    row.className = 'ls-row';
    const canvas = document.createElement('canvas');
    canvas.className = 'ls-map';
    lsDrawMiniMap(canvas, def.waypoints);
    row.appendChild(canvas);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = def.name;
    row.appendChild(name);
    const meta = document.createElement('span');
    meta.className = 'desc';
    const waves = Array.isArray(def.waves) ? def.waves.length + ' explicit waves' : (def.totalWaves || 12) + ' procedural waves';
    meta.textContent = (def.difficulty || 'normal') + ' · ' + waves + ' · $' + (def.startMoney !== undefined ? def.startMoney : 'default');
    row.appendChild(meta);
    if (def.uuid) {
      const id = document.createElement('span');
      id.className = 'uuid';
      id.title = def.uuid; // full uuid on hover — the level's identity
      id.textContent = def.uuid.slice(0, 8) + '…';
      row.appendChild(id);
    }
    const exp = document.createElement('button');
    exp.className = 'tower-btn';
    exp.textContent = '💾 Export';
    exp.addEventListener('click', () => lsExportOne(def));
    row.appendChild(exp);
    const del = document.createElement('button');
    del.className = 'tower-btn danger';
    del.textContent = '🗑 Delete';
    del.addEventListener('click', () => lsDelete(def));
    row.appendChild(del);
    wrap.appendChild(row);
  }
}

// The pywebview JS bridge, when running inside the compiled desktop app
// (window.pywebview.api — native Save/Open dialogs). Absent in a regular
// browser, where the Blob/hidden-input fallbacks below apply. WebView2
// silently swallows programmatic blob downloads, so the bridge is the only
// reliable export path in the exe.
function lsBridge() {
  return (window.pywebview && window.pywebview.api) || null;
}

// Export one stored level as its own .json file (named after the level).
async function lsExportOne(def) {
  const data = exportLevelDef(customLevelId(def));
  if (!data) { document.getElementById('lsMsg').textContent = 'Export failed — level not found in the store.'; return; }
  const api = lsBridge();
  if (api) {
    const ok = await api.save_file(data, lgFilename(def.name));
    document.getElementById('lsMsg').textContent = ok
      ? 'Exported "' + def.name + '" — see the save dialog for where it went.'
      : 'Export cancelled.';
    return;
  }
  // Browser fallback: blob download.
  try {
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = lgFilename(def.name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    document.getElementById('lsMsg').textContent = 'Exported "' + def.name + '" to ' + lgFilename(def.name) + '.';
  } catch (err) {
    document.getElementById('lsMsg').textContent = 'Export failed: ' + err.message;
  }
}

// Delete one stored level (confirm first — it is gone from the store and the
// dropdown immediately).
function lsDelete(def) {
  if (!confirm('Delete "' + def.name + '"? It will be removed from this browser\'s level store. Export it first if you want a copy.')) return;
  const removed = deleteCustomLevel(customLevelId(def));
  if (!removed) { document.getElementById('lsMsg').textContent = 'Delete failed — level not found in the store.'; return; }
  lsRender();
  document.getElementById('lsMsg').textContent = 'Deleted "' + def.name + '".';
}

// Download the whole custom-level store as one .json file (backup / share).
// A friend imports it back with the Import button; single files from the
// levels/ folder import the same way.
async function lsExportAll() {
  const count = getCustomLevels().length;
  if (!count) { document.getElementById('lsMsg').textContent = 'Nothing to export — create or import levels first.'; return; }
  const api = lsBridge();
  if (api) {
    const ok = await api.save_file(exportCustomLevels(), 'ratland-defense-levels.json');
    document.getElementById('lsMsg').textContent = ok
      ? `Exported ${count} level(s) — see the save dialog for where it went.`
      : 'Export cancelled.';
    return;
  }
  // Browser fallback: blob download.
  try {
    const url = URL.createObjectURL(new Blob([exportCustomLevels()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ratland-defense-levels.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    document.getElementById('lsMsg').textContent = `Exported ${count} level(s) to ratland-defense-levels.json.`;
  } catch (err) {
    document.getElementById('lsMsg').textContent = 'Export failed: ' + err.message;
  }
}

// Import .json level files (single def or an array — an export file or the
// levels/ folder format). Every entry is validated; duplicates are skipped.
async function lsImport() {
  const api = lsBridge();
  if (api) {
    // Desktop app: native multi-file Open dialog; the Python side reads the
    // files and hands back {name, content} pairs.
    const files = await api.open_files();
    if (!files || !files.length) return; // user cancelled
    let added = 0, skipped = 0;
    const problems = [];
    for (const f of files) {
      let parseOk = false, defs;
      try { defs = JSON.parse(f.content); parseOk = true; } catch (err) { /* fall through */ }
      if (!parseOk || !defs || typeof defs !== 'object') {
        skipped += 1;
        problems.push(f.name + ': not a level object or array');
      } else {
        const r = importLevelDefs(defs); // single def or array — both handled
        added += r.added; skipped += r.skipped;
        problems.push(...r.problems.map(p => f.name + ': ' + p));
      }
    }
    lsRender(); // new levels appear in the list immediately
    lsImportReport(files.length, added, skipped, problems);
    return;
  }
  // Browser fallback: hidden file input.
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.multiple = true;
  input.addEventListener('change', () => {
    const files = [...input.files];
    if (!files.length) return;
    let added = 0, skipped = 0, done = 0;
    const problems = [];
    for (const f of files) {
      const reader = new FileReader();
      reader.onload = () => {
        let parseOk = false, defs;
        try { defs = JSON.parse(String(reader.result)); parseOk = true; } catch (err) { /* fall through */ }
        if (!parseOk || !defs || typeof defs !== 'object') {
          skipped += 1;
          problems.push(f.name + ': not a level object or array');
        } else {
          const r = importLevelDefs(defs); // single def or array — both handled
          added += r.added; skipped += r.skipped;
          problems.push(...r.problems.map(p => f.name + ': ' + p));
        }
        if (++done === files.length) {
          lsRender(); // new levels appear in the list immediately
          lsImportReport(files.length, added, skipped, problems);
        }
      };
      reader.readAsText(f);
    }
  });
  input.click();
}

// Report line for imports (called once every file has finished reading).
function lsImportReport(fileCount, added, skipped, problems) {
  const msg = `Imported ${added} new level(s) from ${fileCount} file(s)` +
    (skipped ? `, skipped ${skipped} (duplicate or invalid)` : '') + '.';
  document.getElementById('lsMsg').textContent = problems.length
    ? msg + ' Problems: ' + problems.slice(0, 5).join(' | ')
    : msg;
}

// Wire up the page once the DOM is ready.
function lsInit() {
  const expAll = document.getElementById('lsExportAll');
  if (expAll) expAll.addEventListener('click', lsExportAll);
  const imp = document.getElementById('lsImport');
  if (imp) imp.addEventListener('click', lsImport);
  lsRender();
}
