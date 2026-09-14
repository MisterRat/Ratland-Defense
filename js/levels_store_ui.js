// Stored Levels page logic (js/levels.html): lists every level in the
// localStorage custom-level store with per-level actions — Export (single
// .json file, named after the level) and Delete (removes it from the store
// AND the live registry). The whole-store Export lives on the generator page.

// Render one row per stored level: name + meta + uuid short form + buttons.
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

// Download one stored level as its own .json file (named after the level).
function lsExportOne(def) {
  const data = exportLevelDef(customLevelId(def));
  if (!data) { document.getElementById('lsMsg').textContent = 'Export failed — level not found in the store.'; return; }
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

// Wire up the page once the DOM is ready.
function lsInit() {
  lsRender();
}
