// Bottom bar rendering (extracted from ui.js in Phase 62 — the 500-line limit):
// the wave-composition preview / Game Stats fallback in #wpLeft and the
// all-time stats zone in #wpTotal. Owns its rebuild keys so the DOM only
// changes when values move. Loaded before js/ui.js (index.html); ui.js keeps
// thin delegating methods so main.js's per-frame calls are unchanged.

class BottomBar {
  constructor(ui) {
    this.ui = ui;
    this._wpKey = null;      // wave-preview / stats-bar rebuild key
    this._wpTotalKey = null; // all-time zone rebuild key
  }

  // Bottom bar: while between waves it shows the upcoming wave's enemy
  // composition (swatch + count per type) so the player can plan placement
  // before sending. The list comes from buildWave() — the same function that
  // spawns the wave, so the preview is always accurate. Phase 35: the bar is
  // ALWAYS visible — when no next wave is pending (build phase, wave in
  // progress, after the final wave) it falls back to a Game Stats readout.
  // Phase 52: all content lives in #wpLeft; #wpTotal (all-time stats + reset)
  // is its own zone on the right, rendered by syncTotalStats().
  syncWavePreview() {
    const box = this.ui.el.wavePreview;
    if (!box) return;
    const left = this.ui.el.wpLeft || box; // legacy stub DOMs without #wpLeft
    const g = this.ui.game;
    const next = g.waves.current + 1;
    const pending = !g.building && g.status === 'playing' &&
      !g.waves.inProgress && next <= g.waves.totalWaves;
    box.style.visibility = 'visible'; // always visible (Phase 35)
    if (!pending) { this.renderStatsBar(left); return; }
    // Count the composition once per wave (cheap enough to recompute, but the
    // key avoids rebuilding the DOM every frame).
    const list = buildWave(next, g.levelIndex, g.waves.explicitWaves);
    const counts = {};
    for (const t of list) counts[t] = (counts[t] || 0) + 1;
    const key = next + ':' + Object.keys(counts).sort().map(k => k + 'x' + counts[k]).join(',');
    if (key !== this._wpKey) {
      this._wpKey = key;
      left.innerHTML = '';
      const label = document.createElement('span');
      label.className = 'wp-label';
      label.textContent = `Wave ${next}:`;
      left.appendChild(label);
      for (const [type, n] of Object.entries(counts)) {
        const chip = document.createElement('span');
        chip.className = 'wp-chip';
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = ENEMY_TYPES[type].color;
        chip.appendChild(swatch);
        chip.insertAdjacentHTML('beforeend', `<span>${ENEMY_TYPES[type].name} ×${n}</span>`);
        left.appendChild(chip);
      }
    }
  }

  // Phase 35: the bar's fallback content — a Game Stats readout (one chip per
  // stat). Keyed on the values so the DOM only rebuilds when something moves.
  renderStatsBar(box) {
    const s = this.ui.game.stats;
    const dmg = Math.round(s.damageDealt);
    const key = `stats:${dmg}|${s.towersBuilt}|${s.towersSold}|${s.towersDestroyed}|${s.leaked}|${s.dotKills}|${s.directKills}`;
    if (key === this._wpKey) return;
    this._wpKey = key;
    box.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'wp-label';
    label.textContent = 'Stats:';
    box.appendChild(label);
    const items = [
      [`⚔ ${dmg.toLocaleString('en-US')} dmg`, ''],
      [`🏗 ${s.towersBuilt} built`, ''],
      [`💸 ${s.towersSold} sold`, ''],
      [`💥 ${s.towersDestroyed} lost`, ''],
      [`💀 ${s.leaked} leaked`, ''],
      [`🔥 ${s.dotKills} DoT kills`, ''],
      [`⚡ ${s.directKills} direct kills`, ''],
    ];
    for (const [text] of items) {
      const chip = document.createElement('span');
      chip.className = 'wp-chip';
      chip.insertAdjacentHTML('beforeend', `<span>${text}</span>`);
      box.appendChild(chip);
    }
  }

  // Phase 52: the bottom bar's RIGHT zone — all-time (of all time) stats plus
  // the Reset button. Shows the STORED totals as-is (folded in at level end by
  // main.js, not live-updated). Keyed on the values so the DOM only rebuilds
  // when something moves; the reset button re-binds its handler on every
  // rebuild (cheap — rebuilds are rare).
  syncTotalStats() {
    const box = this.ui.el.wpTotal;
    if (!box) return;
    const t = getTotalStats();
    const key = `total:${t.damageDealt}|${t.kills}|${t.towersBuilt}|${t.towersSold}|${t.towersDestroyed}` +
      `|${t.leaked}|${t.dotKills}|${t.directKills}|${t.moneyEarned}|${t.levelsWon}`;
    if (key === this._wpTotalKey) return;
    this._wpTotalKey = key;
    box.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'wp-label';
    label.textContent = 'All-time:';
    box.appendChild(label);
    const items = [
      [`🏆 ${t.levelsWon} won`, ''],
      [`⚔ ${t.damageDealt.toLocaleString('en-US')} dmg`, ''],
      [`💀 ${t.kills} kills`, ''],
      [`🏗 ${t.towersBuilt} built`, ''],
      [`💸 ${t.towersSold} sold`, ''],
      [`💥 ${t.towersDestroyed} lost`, ''],
      [`💦 ${t.leaked} leaked`, ''],
    ];
    for (const [text] of items) {
      const chip = document.createElement('span');
      chip.className = 'wp-chip';
      chip.insertAdjacentHTML('beforeend', `<span>${text}</span>`);
      box.appendChild(chip);
    }
    const reset = document.createElement('button');
    reset.id = 'wpResetBtn';
    reset.textContent = '↺ Reset';
    reset.title = 'Clear all-time stats';
    reset.addEventListener('click', () => this.ui.handlers.onResetTotalStats());
    box.appendChild(reset);
  }
}
