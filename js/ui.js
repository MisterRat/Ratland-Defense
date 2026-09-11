// DOM UI: HUD values, tower shop, selected-tower panel, control buttons.

const DEFAULT_MSG = 'Pick a tower, then click a grass tile to build. Right-click or Esc cancels.';

class UI {
  constructor(game, view, handlers, progress) {
    this.game = game;
    this.view = view;
    this.progress = progress || loadProgress(); // shared object owned by main.js
    this.handlers = handlers; // {onPickType, onSendWave, onSpeed, onUpgrade, onSell, onTargetMode}
    this.lastHud = {};
    this.cache = {};
    this.upgradeBtn = null;   // live reference so affordability can refresh each frame
    this.el = {
      money: document.getElementById('money'),
      lives: document.getElementById('lives'),
      wave: document.getElementById('wave'),
      waveMax: document.getElementById('waveMax'),
      score: document.getElementById('score'),
      nextWaveBtn: document.getElementById('nextWaveBtn'),
      speedBtn: document.getElementById('speedBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      muteBtn: document.getElementById('muteBtn'),
      levelSelect: document.getElementById('levelSelect'),
      shop: document.getElementById('shop'),
      towerPanel: document.getElementById('towerPanel'),
      msg: document.getElementById('msg'),
    };
    this.buildEnemyLegend();
    this.buildShop();
    this.buildLevelSelect();
    this.syncLevelSelect(); // point the dropdown at the map the game actually runs
    this.bindButtons();
  }

  // Left-hand enemy legend: name, color swatch, and resistance.
  // Order is intentional — keep it in sync with the design list.
  buildEnemyLegend() {
    const el = document.getElementById('legend');
    if (!el) return;
    el.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'name';
    header.textContent = 'Enemies';
    el.appendChild(header);
    const order = ['normal', 'tank', 'hot', 'wet', 'fast', 'camo',
                   'fission', 'spore', 'bolt', 'bulwark', 'mender', 'wisp', 'boss'];
    for (const key of order) {
      const def = ENEMY_TYPES[key];
      const row = document.createElement('div');
      row.className = 'legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = def.color;
      row.appendChild(swatch);
      row.insertAdjacentHTML('beforeend', `<span class="name">${def.name}</span>`);
      if (def.resist.length) {
        const res = document.createElement('span');
        res.className = 'desc';
        res.textContent = def.resist.length === Object.keys(TOWER_TYPES).length
          ? 'resists all towers'
          : 'resists ' + def.resist.map(k => TOWER_TYPES[k].name).join(', ');
        row.appendChild(res);
      }
      el.appendChild(row);
    }
  }

  buildLevelSelect() {
    this.el.levelSelect.innerHTML = '';
    getLevels().forEach((lvl, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      // Custom levels (from the generator page) are always playable.
      const open = i < this.progress.unlocked || !!lvl.custom;
      const diff = (typeof LG_DIFFICULTY !== 'undefined' && LG_DIFFICULTY[lvl.difficulty])
        ? LG_DIFFICULTY[lvl.difficulty].label : 'Normal';
      opt.textContent = open
        ? `${i + 1} — ${lvl.name} · ${diff}${lvl.custom ? ' 🎲' : ''}`
        : `🔒 ${i + 1} — ${lvl.name} · ${diff} (locked)`;
      opt.disabled = !open;
      this.el.levelSelect.appendChild(opt);
    });
  }

  // Point the dropdown at the map the game is actually running (single source
  // of truth: game.levelIndex). Runs after buildLevelSelect and whenever a
  // level switch or win-rebuild happens, so the selector can never drift.
  // Also sets the wave counter max to the CURRENT level's totalWaves.
  syncLevelSelect() {
    this.el.levelSelect.value = String(this.game.levelIndex);
    const lvl = getLevel(this.game.levelIndex);
    this.el.waveMax.textContent = lvl ? lvl.totalWaves : TOTAL_WAVES;
  }

  // Rebuild the level list after a win unlocks a new level.
  refreshLevelSelect() {
    this.buildLevelSelect();
    this.syncLevelSelect();
  }

  buildShop() {
    this.el.shop.innerHTML = '';
    for (const [type, def] of Object.entries(TOWER_TYPES)) {
      const btn = document.createElement('button');
      btn.className = 'shop-item';
      btn.dataset.type = type;
      btn.dataset.unlock = def.unlockLevel; // 1-based map level it unlocks at
      btn.innerHTML = `<span class="name">${def.name}</span><span class="cost">${formatMoney(def.cost)}</span>
        <div class="desc">${def.desc}</div>`;
      btn.addEventListener('click', () => this.handlers.onPickType(type));
      this.el.shop.appendChild(btn);
    }
  }

  // Mute button: label reflects SFX.muted; the click is a user gesture, so it
  // also unlocks (creates/resumes) the AudioContext for subsequent sounds.
  bindMuteButton() {
    const btn = this.el.muteBtn;
    if (!btn) return;
    btn.textContent = SFX.muted ? '🔇 Muted' : '🔊 Sound';
    btn.addEventListener('click', () => {
      SFX.ensure(); // user gesture: safe to create/resume the context now
      const muted = SFX.toggleMute();
      btn.textContent = muted ? '🔇 Muted' : '🔊 Sound';
    });
  }

  bindButtons() {
    this.el.nextWaveBtn.addEventListener('click', () => this.handlers.onSendWave());
    this.el.speedBtn.addEventListener('click', () => this.handlers.onSpeed());
    this.el.pauseBtn.addEventListener('click', () => this.handlers.onPause());
    this.bindMuteButton();
    this.el.levelSelect.addEventListener('change', e => {
      this.handlers.onLevelChange(Number(e.target.value));
    });
  }

  // Reflect the paused state on the Pause button.
  setPaused(paused) {
    this.el.pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  }

  // Called every frame; writes only when a value changed.
  updateHUD() {
    const g = this.game;
    this.set('money', formatMoney(g.money));
    this.set('lives', String(g.lives));
    this.set('wave', String(g.waves.current));
    this.set('score', g.score.toLocaleString('en-US')); // live score, thousands-separated
    const canSend = !g.building && g.status === 'playing' && !g.waves.inProgress && g.waves.current < g.waves.totalWaves;
    this.el.nextWaveBtn.disabled = !canSend;
    const msg = g.message || (g.building ? 'Place your first tower, then press ▶ Resume to start.' : DEFAULT_MSG);
    if (this.lastHud.msg !== msg) {
      this.lastHud.msg = msg;
      this.el.msg.textContent = msg;
    }
    // Keep the selected tower's upgrade button in sync with current money.
    if (this.upgradeBtn) {
      const t = this.view.selectedTower;
      const cost = t ? t.upgradeCost() : null;
      this.upgradeBtn.disabled = cost == null || g.money < cost;
    }
  }

  set(field, value) {
    if (this.lastHud[field] !== value) {
      this.lastHud[field] = value;
      this.el[field].textContent = value;
    }
  }

  // Highlight the shop button matching view.placingType; lock towers not yet
  // unlocked on the current map level (label shows the level they unlock at).
  syncShopSelection() {
    const lvl = this.game.levelIndex;
    for (const btn of this.el.shop.children) {
      const def = TOWER_TYPES[btn.dataset.type];
      const locked = !isTowerAvailable(btn.dataset.type, lvl);
      btn.classList.toggle('selected', !locked && btn.dataset.type === this.view.placingType);
      btn.disabled = locked || this.game.money < def.cost;
      const nameEl = btn.querySelector('.name');
      const label = locked ? `🔒 ${def.name} — Lv ${def.unlockLevel}` : def.name;
      if (nameEl && nameEl.textContent !== label) nameEl.textContent = label;
    }
  }

  // Show/hide the panel for a selected tower.
  renderTowerPanel(tower) {
    const panel = this.el.towerPanel;
    if (!tower) { panel.style.display = 'none'; this.upgradeBtn = null; return; }
    panel.style.display = 'block';
    const def = TOWER_TYPES[tower.type];
    const upCost = tower.upgradeCost();
    const stats = `dmg ${Math.round(tower.damage)} · rng ${Math.round(tower.range)} · ${tower.fireRate.toFixed(1)}/s`;
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.innerHTML = `<span class="name" style="color:${def.color}">${def.name}</span>
      <span class="cost">Lv ${tower.level}</span><div class="desc">${stats}</div>`;
    panel.appendChild(head);

    // Targeting mode selector.
    const targetRow = document.createElement('div');
    targetRow.className = 'target-row';
    const label = document.createElement('span');
    label.className = 'name';
    label.textContent = 'Target:';
    const sel = document.createElement('select');
    sel.className = 'tower-btn';
    for (const [mode, labelName] of Object.entries(TARGET_MODES)) {
      const opt = document.createElement('option');
      opt.value = mode;
      opt.textContent = labelName;
      sel.appendChild(opt);
    }
    // Set AFTER the options exist — assigning .value before the matching
    // option is in the select is a no-op, so the dropdown would always show
    // the first entry regardless of the tower's actual mode.
    sel.value = tower.targetMode;
    sel.addEventListener('change', () => this.handlers.onTargetMode(tower, sel.value));
    targetRow.appendChild(label);
    targetRow.appendChild(sel);
    panel.appendChild(targetRow);

    if (upCost != null) {
      const up = document.createElement('button');
      up.className = 'tower-btn';
      up.textContent = `Upgrade — ${formatMoney(upCost)}`;
      up.disabled = this.game.money < upCost;
      up.addEventListener('click', () => this.handlers.onUpgrade(tower));
      panel.appendChild(up);
      this.upgradeBtn = up;
    } else {
      this.upgradeBtn = null;
      const max = document.createElement('div');
      max.className = 'desc';
      max.textContent = 'Max level';
      panel.appendChild(max);
    }

    const sell = document.createElement('button');
    sell.className = 'tower-btn';
    sell.textContent = `Sell — ${formatMoney(tower.sellValue())}`;
    sell.addEventListener('click', () => this.handlers.onSell(tower));
    panel.appendChild(sell);
  }

  setMessage(text) {
    this.el.msg.textContent = text;
  }
}
