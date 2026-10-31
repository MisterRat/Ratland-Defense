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
    this.bottomBar = new BottomBar(this); // Phase 62: bottom-bar rendering (ui_bottombar.js)
    this.upgradeBtn = null;   // live reference so affordability can refresh each frame
    // Phase 64: live refs to the panel's custom dropdowns (null when absent).
    this.ammoDd = null;
    this.targetDd = null;
    this.preferDd = null;
    this.el = {
      money: document.getElementById('money'),
      lives: document.getElementById('lives'),
      wave: document.getElementById('wave'),
      waveMax: document.getElementById('waveMax'),
      score: document.getElementById('score'),
      nextWaveBtn: document.getElementById('nextWaveBtn'),
      wavePreview: document.getElementById('wavePreview'),
      showRangesBtn: document.getElementById('showRangesBtn'),
      speedBtn: document.getElementById('speedBtn'),
      pauseBtn: document.getElementById('pauseBtn'),
      muteBtn: document.getElementById('muteBtn'),
      musicBtn: document.getElementById('musicBtn'),
      diffSelect: document.getElementById('diffSelect'),
      levelSelect: document.getElementById('levelSelect'),
      shop: document.getElementById('shop'),
      towerPanel: document.getElementById('towerPanel'),
      msg: document.getElementById('msg'),
      // Phase 52: the bottom bar's two zones — left = wave preview / this
      // level's stats, right = all-time stats + reset button.
      wpLeft: document.getElementById('wpLeft'),
      wpTotal: document.getElementById('wpTotal'),
      helpBtn: document.getElementById('helpBtn'), // Phase 66
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
      } else if (def.desc) {
        // No resist to show: a short 2-word blurb under the name instead.
        const d = document.createElement('span');
        d.className = 'desc';
        d.textContent = def.desc;
        row.appendChild(d);
      }
      el.appendChild(row);
    }
  }

  // Grey out legend rows for enemy types that are not active on the current
  // map. "Active" is levelActiveEnemies(): explicit-wave levels (external /
  // custom .json) use their own wave lists, procedural levels the unlockLevel
  // gate. Called each frame — the classList toggle is a no-op when unchanged.
  syncEnemyLegend() {
    const el = document.getElementById('legend');
    if (!el) return;
    const active = levelActiveEnemies(this.game.levelIndex);
    const order = ['normal', 'tank', 'hot', 'wet', 'fast', 'camo',
                   'fission', 'spore', 'bolt', 'bulwark', 'mender', 'wisp', 'boss'];
    let i = 0; // rows start after the "Enemies" header
    for (const key of order) {
      const row = el.children[++i];
      if (!row) break;
      row.classList.toggle('inactive', !active.has(key));
    }
  }

  buildLevelSelect() {
    this.el.levelSelect.innerHTML = '';
    getLevels().forEach((lvl, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      // Custom levels (localStorage store — created on the generator page or
      // imported) are always playable; only built-in levels past
      // progress.unlocked stay locked.
      const open = i < this.progress.unlocked || !!lvl.custom;
      // Phase 44: the label shows the EFFECTIVE difficulty (player override or
      // built-in key) — the same value the waves actually use.
      const diffKey = (typeof effectiveDifficulty === 'function')
        ? effectiveDifficulty(i) : lvl.difficulty;
      const diff = (typeof LG_DIFFICULTY !== 'undefined' && LG_DIFFICULTY[diffKey])
        ? LG_DIFFICULTY[diffKey].label : 'Normal';
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
    this.syncDiffSelect(); // Phase 44: the dropdown follows the level's effective difficulty
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
      // Warden: dynamic cost — show the initial $300; updated each frame.
      const costLabel = def.dynamicCost ? formatMoney(300) : formatMoney(def.cost);
      btn.innerHTML = `<span class="name">${def.name}</span><span class="cost">${costLabel}</span>
        <div class="desc">${def.desc}</div>`;
      btn.addEventListener('click', () => this.handlers.onPickType(type));
      this.el.shop.appendChild(btn);
    }
  }

  // Mute button (Phase 60): mutes SOUND EFFECTS only — SFX.muted gates
  // SFX.play(); the music engine no longer reads it, so 🎵 music is untouched.
  // Label reflects SFX.muted; the click is a user gesture, so it also unlocks
  // (creates/resumes) the AudioContext for subsequent sounds.
  bindMuteButton() {
    const btn = this.el.muteBtn;
    if (!btn) return;
    btn.textContent = SFX.muted ? '🔇 Muted' : '🔊 SFX';
    btn.addEventListener('click', () => {
      SFX.ensure(); // user gesture: safe to create/resume the context now
      const muted = SFX.toggleMute();
      btn.textContent = muted ? '🔇 Muted' : '🔊 SFX';
    });
  }

  // Phase 44: difficulty dropdown — the four LG_DIFFICULTY rows, current
  // selection (effective difficulty) highlighted. Changing it reloads the level.
  buildDiffSelect() {
    const sel = this.el.diffSelect;
    if (!sel) return;
    sel.innerHTML = '';
    for (const key of DIFFICULTY_KEYS) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = LG_DIFFICULTY[key].label;
      sel.appendChild(opt);
    }
    this.syncDiffSelect();
  }

  syncDiffSelect() {
    const sel = this.el.diffSelect;
    if (!sel) return;
    sel.value = (typeof effectiveDifficulty === 'function')
      ? effectiveDifficulty(this.game.levelIndex) : 'normal';
  }

  // Phase 44: music start/stop button — the click is the user gesture that
  // lets the browser create the AudioContext. Label reflects current state.
  bindMusicButton() {
    const btn = this.el.musicBtn;
    if (!btn) return;
    btn.textContent = Music.playing ? '🎵 Stop' : '🎵 Start';
    btn.addEventListener('click', () => this.handlers.onMusic());
  }

  bindButtons() {
    this.el.nextWaveBtn.addEventListener('click', () => this.handlers.onSendWave());
    if (this.el.showRangesBtn) this.el.showRangesBtn.addEventListener('click', () => this.handlers.onShowRanges());
    this.el.speedBtn.addEventListener('click', () => this.handlers.onSpeed());
    this.el.pauseBtn.addEventListener('click', () => this.handlers.onPause());
    // Phase 66: ❓ Help (bottom bar) — opens the README modal.
    if (this.el.helpBtn && this.handlers.onHelp) this.el.helpBtn.addEventListener('click', () => this.handlers.onHelp());
    this.bindMuteButton();
    this.bindMusicButton();
    if (this.el.diffSelect) {
      this.buildDiffSelect();
      this.el.diffSelect.addEventListener('change', e => {
        this.handlers.onDifficulty(e.target.value);
      });
    }
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

  // Phase 62: bottom-bar rendering moved to js/ui_bottombar.js (BottomBar) —
  // thin delegations so main.js's per-frame calls are unchanged.
  syncWavePreview() { this.bottomBar.syncWavePreview(); }
  renderStatsBar(box) { this.bottomBar.renderStatsBar(box); }
  syncTotalStats() { this.bottomBar.syncTotalStats(); }

  // "Show Ranges" toggle: label reflects view.showRanges (active state).
  syncShowRangesBtn() {
    const btn = this.el.showRangesBtn;
    if (!btn) return;
    const on = !!this.view.showRanges;
    btn.classList.toggle('selected', on);
    const label = on ? '◎ Ranges: ON' : '◎ Ranges';
    if (btn.textContent !== label) btn.textContent = label;
  }

  // Highlight the shop button matching view.placingType; lock towers not yet
  // unlocked on the current map level (label shows the level they unlock at)
  // and towers outside the level's roster (Phase 29: "not on this level").
  syncShopSelection() {
    const lvl = this.game.levelIndex;
    for (const btn of this.el.shop.children) {
      const def = TOWER_TYPES[btn.dataset.type];
      // Warden: dynamic cost ($300 first, +$100 per existing Warden).
      const cost = def.dynamicCost ? this.game.wardenCost() : def.cost;
      const unlocked = isTowerAvailable(btn.dataset.type, lvl);
      const locked = !isTowerAllowedOnLevel(btn.dataset.type, lvl);
      btn.classList.toggle('selected', !locked && btn.dataset.type === this.view.placingType);
      btn.disabled = locked || this.game.money < cost;
      const nameEl = btn.querySelector('.name');
      const label = locked
        ? (unlocked ? `🔒 ${def.name} — not on this level` : `🔒 ${def.name} — Lv ${def.unlockLevel}`)
        : def.name;
      if (nameEl && nameEl.textContent !== label) nameEl.textContent = label;
      const costEl = btn.querySelector('.cost');
      if (costEl) {
        const costLabel = formatMoney(cost);
        if (costEl.textContent !== costLabel) costEl.textContent = costLabel;
      }
    }
  }

  // Phase 34: next-level stat preview for the Upgrade button's tooltip,
  // computed from LEVEL_SCALE (the same formula the Tower getters use).
  // Mirrors the panel's stat-line branches per tower type.
  upgradePreview(tower) {
    const def = TOWER_TYPES[tower.type];
    const n = tower.level + 1;
    const ds = LEVEL_SCALE.damage[n - 1];
    const dr = LEVEL_SCALE.range[n - 1];
    const df = LEVEL_SCALE.fireRate[n - 1];
    if (def.aura) {
      return `L${n}: +${Math.round((def.aura.multiplier - 1) * 100)}% dmg · rng ${Math.round(def.range * dr)}`;
    }
    if (def.income) {
      return `L${n}: +${formatMoney(Math.round(def.income.amount * ds))} / ${def.income.interval}s`;
    }
    if (def.ammoTypes) {
      const ammoDmg = Math.round(TOWER_TYPES[tower.ammo].damage * ds);
      return `L${n}: blast ${Math.round(def.range * dr)} · ${ammoDmg} dmg (${TOWER_TYPES[tower.ammo].name}) · ${(def.fireRate * df).toFixed(1)}/s`;
    }
    return `L${n}: dmg ${Math.round(def.damage * ds)} · rng ${Math.round(def.range * dr)} · ${(def.fireRate * df).toFixed(1)}/s`;
  }

  // Phase 64: the tower-detail row is a CONSTANT-HEIGHT full-width bar (CSS in
  // index.html) that always stays visible — no selection shows a placeholder,
  // so selecting/deselecting never changes the page's layout size. The
  // dropdowns are custom Dropdown instances (js/ui_dropdown.js) that open
  // UPWARD over the play area; live refs are kept on this.ammoDd/targetDd/
  // preferDd (null when not applicable) for tests and future syncs.
  renderTowerPanel(tower) {
    const panel = this.el.towerPanel;
    this.ammoDd = null;
    this.targetDd = null;
    this.preferDd = null;
    if (!tower) {
      panel.innerHTML = '';
      const ph = document.createElement('span');
      ph.className = 'tp-placeholder';
      ph.textContent = 'Click a tower to inspect it.';
      panel.appendChild(ph);
      this.upgradeBtn = null;
      return;
    }
    const def = TOWER_TYPES[tower.type];
    const upCost = tower.upgradeCost();
    // Non-combat towers (Warden aura, Mint income) show their special stats.
    let stats;
    if (def.aura) {
      stats = `+${Math.round((def.aura.multiplier - 1) * 100)}% dmg · rng ${Math.round(tower.range)}`;
    } else if (def.income) {
      const amt = Math.round(def.income.amount * LEVEL_SCALE.damage[tower.level - 1]);
      stats = `+${formatMoney(amt)} / ${def.income.interval}s`;
    } else if (def.ammoTypes) {
      const ammoDmg = Math.round(TOWER_TYPES[tower.ammo].damage * LEVEL_SCALE.damage[tower.level - 1]);
      stats = `blast ${Math.round(tower.range)} · ${ammoDmg} dmg (${TOWER_TYPES[tower.ammo].name}) · ${tower.fireRate.toFixed(2)}/s`;
    } else {
      stats = `dmg ${Math.round(tower.damage)} · rng ${Math.round(tower.range)} · ${tower.fireRate.toFixed(1)}/s`;
    }
    panel.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'tp-head';
    head.innerHTML = `<span class="name" style="color:${def.color}">${def.name}</span>
      <span class="cost">Lv ${tower.level}</span><span class="desc">${stats}</span>`;
    panel.appendChild(head);

    if (def.ammoTypes) {
      // Mortar: an Ammo dropdown (payload flavor) instead of Target modes.
      this.ammoDd = new Dropdown(panel, 'Ammo',
        def.ammoTypes.map(a => ({ value: a, text: TOWER_TYPES[a].name })),
        tower.ammo, v => this.handlers.onAmmo(tower, v));
      const retarget = document.createElement('button');
      retarget.className = 'tower-btn';
      retarget.textContent = tower.targetPoint ? 'Change Target' : 'Set Target (click any tile)';
      retarget.addEventListener('click', () => this.handlers.onMortarRetarget(tower));
      panel.appendChild(retarget);
    } else {
      // Targeting mode selector.
      this.targetDd = new Dropdown(panel, 'Target',
        Object.entries(TARGET_MODES).map(([mode, labelName]) => ({ value: mode, text: labelName })),
        tower.targetMode, v => this.handlers.onTargetMode(tower, v));

      // Phase 62: Prefer dropdown — a type to aim at first (fallback to the
      // position mode when none is in range). Options = types ACTIVE on this
      // level, so the list stays short. The tower's stored preference may name
      // a type inactive here; keep it selectable so the panel stays truthful.
      const preferOpts = [{ value: '', text: 'Any' }];
      const active = levelActiveEnemies(this.game.levelIndex);
      for (const [key, edef] of Object.entries(ENEMY_TYPES)) {
        if (!active.has(key) && tower.preferType !== key) continue;
        preferOpts.push({ value: key, text: edef.name });
      }
      this.preferDd = new Dropdown(panel, 'Prefer', preferOpts,
        tower.preferType || '', v => this.handlers.onPreferType(tower, v || null));
    }

    if (upCost != null) {
      const up = document.createElement('button');
      up.className = 'tower-btn';
      up.textContent = `Upgrade — ${formatMoney(upCost)}`;
      // Phase 34: hover tooltip previewing the next level's stats.
      up.title = this.upgradePreview(tower);
      up.disabled = this.game.money < upCost;
      up.addEventListener('click', () => this.handlers.onUpgrade(tower));
      panel.appendChild(up);
      this.upgradeBtn = up;
    } else {
      this.upgradeBtn = null;
      const max = document.createElement('span');
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
