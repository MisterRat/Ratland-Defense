// Level generator — page UI. Options form (enemy checkboxes, tower-roster
// checkboxes, difficulty, money, waves, name), Generate → 4 preview cards
// (canvas diagram + stats + checkbox), Create / Try Again buttons. Loaded by
// levelgen.html only. Phase 29: the tower roster (which towers are buildable
// on the generated level) is selected with the same checkbox pattern as the
// enemy list, and flows into the saved def's `towers` field.

const LG_DIAGRAM_CELL = 10; // px per grid cell in the preview canvas

// Cells re-entered by the spline walk = crossovers (for highlighting).
// Uses the shared sample-based walker so the highlight matches the curve.
function lgCrossoverCells(waypoints) {
  const counts = new Map();
  for (const k of walkPathCells(waypoints).seq) counts.set(k, (counts.get(k) || 0) + 1);
  const out = new Set();
  for (const [k, n] of counts) if (n >= 2) out.add(k);
  return out;
}

// Draw the path diagram on a small canvas: grid, path line, spawn/exit
// markers, crossover cells highlighted.
function lgDrawDiagram(canvas, waypoints) {
  const ctx = canvas.getContext('2d');
  const W = GRID.cols * LG_DIAGRAM_CELL, H = GRID.rows * LG_DIAGRAM_CELL;
  canvas.width = W; canvas.height = H;
  ctx.fillStyle = '#1d232c';
  ctx.fillRect(0, 0, W, H);
  // Checkerboard.
  for (let x = 0; x < GRID.cols; x++) for (let y = 0; y < GRID.rows; y++) {
    if ((x + y) % 2 === 0) continue;
    ctx.fillStyle = '#212936';
    ctx.fillRect(x * LG_DIAGRAM_CELL, y * LG_DIAGRAM_CELL, LG_DIAGRAM_CELL, LG_DIAGRAM_CELL);
  }
  // Crossover cells.
  const cross = lgCrossoverCells(waypoints);
  ctx.fillStyle = 'rgba(255, 215, 106, 0.45)';
  for (const k of cross) {
    const [cx, cy] = k.split(',').map(Number);
    if (cx < 0 || cx >= GRID.cols || cy < 0 || cy >= GRID.rows) continue;
    ctx.fillRect(cx * LG_DIAGRAM_CELL, cy * LG_DIAGRAM_CELL, LG_DIAGRAM_CELL, LG_DIAGRAM_CELL);
  }
  // Path line: the actual spline, sampled at diagram scale.
  ctx.strokeStyle = '#4fa3ff';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  sampleSpline(waypoints, LG_DIAGRAM_CELL).forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  // Spawn marker (green square at left edge) and exit marker (red at right).
  const [sx, sy] = waypoints[0];
  const [ex, ey] = waypoints[waypoints.length - 1];
  ctx.fillStyle = '#3ddc84';
  ctx.fillRect(0, (sy + 0.5) * LG_DIAGRAM_CELL - 4, 6, 8);
  ctx.fillStyle = '#ff5da2';
  ctx.fillRect(W - 6, (ey + 0.5) * LG_DIAGRAM_CELL - 4, 6, 8);
}

// Build the enemy-type checkboxes into `wrap`: every selectable type
// (childOnly types like Spore are excluded — they only spawn from Fission),
// in config order. Minion + Colossus start checked as sensible defaults.
// Rows use index.html's .legend-item style (swatch + name + desc) with a
// checkbox prepended so the player picks the enemy roster.
function lgBuildEnemyCheckboxes(wrap, enemyTypes) {
  for (const key of Object.keys(enemyTypes).filter(k => !enemyTypes[k].childOnly)) {
    const def = enemyTypes[key];
    const label = document.createElement('label');
    label.className = 'legend-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = key;
    cb.checked = key === 'normal' || key === 'boss'; // sensible defaults
    label.appendChild(cb);
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.background = def.color;
    label.appendChild(swatch);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = def.name;
    label.appendChild(name);
    if (def.desc) {
      const d = document.createElement('span');
      d.className = 'desc';
      d.textContent = def.desc;
      label.appendChild(d);
    }
    wrap.appendChild(label);
  }
}

// Set every enemy checkbox in `wrap` to `on` (Select All / Clear).
function lgSelectAllEnemies(wrap, on) {
  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = on; });
}

// Phase 29: build the tower-roster checkboxes into `wrap`: one row per tower
// type in config order, using index.html's .shop-item style (name + cost +
// desc) with a checkbox prepended. ALL start checked — unchecking a tower
// removes it from the level.
function lgBuildTowerCheckboxes(wrap, towerTypes) {
  for (const key of Object.keys(towerTypes)) {
    const def = towerTypes[key];
    const label = document.createElement('label');
    label.className = 'shop-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = key;
    cb.checked = true; // default: every tower available on the new level
    label.appendChild(cb);
    // Warden: dynamic cost — show the initial $300, like index.html's shop.
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = def.name;
    label.appendChild(name);
    const cost = document.createElement('span');
    cost.className = 'cost';
    cost.textContent = def.dynamicCost ? '$300+' : '$' + Math.floor(def.cost);
    label.appendChild(cost);
    const d = document.createElement('div');
    d.className = 'desc';
    d.textContent = def.desc;
    label.appendChild(d);
    wrap.appendChild(label);
  }
}

// Set every tower checkbox in `wrap` to `on` (Select All / Clear).
function lgSelectAllTowers(wrap, on) {
  wrap.querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = on; });
}

// Read the options form -> { enemies, towers, difficulty, startMoney, waves }.
// (Level names are per-candidate: each gets a silly randomized 2-word name
// the user can edit on its preview card before Create.)
function lgReadOptions() {
  const enemies = [];
  document.querySelectorAll('#lgEnemies input[type=checkbox]:checked').forEach(cb => enemies.push(cb.value));
  const towers = [];
  document.querySelectorAll('#lgTowers input[type=checkbox]:checked').forEach(cb => towers.push(cb.value));
  return {
    enemies,
    towers,
    difficulty: document.getElementById('lgDifficulty').value,
    startMoney: Math.max(0, parseInt(document.getElementById('lgMoney').value, 10) || 0),
    waves: Math.min(50, Math.max(1, parseInt(document.getElementById('lgWaves').value, 10) || 12)),
  };
}

// Current generation state (candidates + their checkboxes).
const lgState = { candidates: [], seed: 0 };

// Generate 4 fresh candidates and render preview cards. Each candidate gets a
// silly randomized 2-word name (stable per press, from its own seeded RNG)
// that the user can edit on the card before Create.
function lgGenerate() {
  const opts = lgReadOptions();
  if (!opts.enemies.length) { document.getElementById('lgMsg').textContent = 'Pick at least one enemy type.'; return; }
  if (!opts.towers.length) { document.getElementById('lgMsg').textContent = 'Pick at least one tower type.'; return; }
  lgState.seed = (Math.random() * 0xFFFFFFFF) >>> 0;
  lgState.candidates = generatePathCandidates(lgState.seed);
  for (const cand of lgState.candidates) {
    const rng = mulberry32(cand._seed ^ 0x9e3779b9); // path seed + salt
    cand._name = lgSillyName(rng);
  }
  lgRenderCards(opts);
  document.getElementById('lgMsg').textContent = lgState.candidates.length + ' candidates generated — check the ones you want, rename if you like, then Create.';
}

// Render one preview card (canvas + editable silly name + stats + checkbox)
// per candidate. The name input is prefilled with the candidate's silly name;
// the user may rename before Create (the name is cosmetic — the uuid is the
// level's real identity).
function lgRenderCards(opts) {
  const wrap = document.getElementById('lgCards');
  wrap.innerHTML = '';
  lgState.candidates.forEach((cand, i) => {
    const card = document.createElement('div');
    card.className = 'lg-card';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'lgPick' + i;
    card.appendChild(cb);
    const canvas = document.createElement('canvas');
    lgDrawDiagram(canvas, cand.waypoints);
    card.appendChild(canvas);
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'lg-name';
    nameInput.id = 'lgName' + i;
    nameInput.value = cand._name;
    nameInput.placeholder = 'Level name';
    card.appendChild(nameInput);
    const stats = document.createElement('div');
    stats.className = 'lg-stats';
    const diffLabel = LG_DIFFICULTY[opts.difficulty] ? LG_DIFFICULTY[opts.difficulty].label : 'Normal';
    stats.textContent = `${cand.template} · ${diffLabel} · path ${cand.stats.length} · ${cand.stats.crossovers} crossover(s) · ${opts.waves} waves · $${opts.startMoney} · ${opts.towers.length}/${Object.keys(TOWER_TYPES).length} towers`;
    card.appendChild(stats);
    wrap.appendChild(card);
  });
}

// Create all checked candidates (save + register), then report. Names come
// from each card's editable input (silly name by default); the uuid — not the
// name — is what makes each level unique, so no name uniquifying is needed.
async function lgCreate() {
  const opts = lgReadOptions();
  if (!opts.towers.length) { document.getElementById('lgMsg').textContent = 'Pick at least one tower type.'; return; }
  const picked = lgState.candidates.filter((c, i) => document.getElementById('lgPick' + i).checked);
  if (!picked.length) { document.getElementById('lgMsg').textContent = 'Check at least one candidate first.'; return; }
  for (const cand of picked) {
    const el = document.getElementById('lgName' + lgState.candidates.indexOf(cand));
    const typed = el ? el.value.trim() : '';
    cand._name = typed || cand._name || 'Generated Level';
  }
  const results = await lgCreateLevels(picked, { ...opts });
  const saved = results.filter(r => r.save && r.save.mode === 'fsa').length;
  const downloaded = results.filter(r => r.save && r.save.mode === 'download').length;
  const registered = results.filter(r => r.registered).length;
  document.getElementById('lgMsg').textContent =
    `Created ${registered} level(s) — ${saved} saved to files, ${downloaded} downloaded. ` +
    (downloaded ? 'Downloaded files: move them into levels/ and run the build tool to make them permanent.' : 'They are playable now (open index.html).');
  lgState.candidates = [];
  document.getElementById('lgCards').innerHTML = '';
}

// Try Again: fresh 4 candidates, same options.
function lgTryAgain() { lgGenerate(); }

// Wire up the page once the DOM is ready.
function lgInit() {
  document.getElementById('lgGenerate').addEventListener('click', lgGenerate);
  document.getElementById('lgCreate').addEventListener('click', () => lgCreate());
  document.getElementById('lgTryAgain').addEventListener('click', lgTryAgain);
  // Select All / Clear: flips every enemy checkbox; auto-flips to uncheck-all
  // when everything is already checked.
  const wrap = document.getElementById('lgEnemies');
  const btn = document.getElementById('lgSelectAll');
  btn.addEventListener('click', () => {
    const boxes = wrap.querySelectorAll('input[type=checkbox]');
    const allChecked = [...boxes].every(cb => cb.checked);
    lgSelectAllEnemies(wrap, !allChecked);
  });
  // Same behavior for the tower roster column (Phase 29).
  const tWrap = document.getElementById('lgTowers');
  const tBtn = document.getElementById('lgSelectAllTowers');
  if (tWrap && tBtn) {
    tBtn.addEventListener('click', () => {
      const boxes = tWrap.querySelectorAll('input[type=checkbox]');
      const allChecked = [...boxes].every(cb => cb.checked);
      lgSelectAllTowers(tWrap, !allChecked);
    });
  }
}
