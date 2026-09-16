// Entry point: wires game, renderer, UI, input; runs the game loop.

const canvas = document.getElementById('game');
let progress = loadProgress();

// Phase 34: persist the selected game speed (1x/2x/3x) across reloads,
// mirroring the mute-persistence pattern (try/catch + validation).
const SPEED_KEY = 'towerDefenseSpeed.v1';
function loadSpeed() {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    if (v === 1 || v === 2 || v === 3) return v;
  } catch (err) { /* no storage available — default speed */ }
  return 1;
}
function saveSpeed(s) {
  try { localStorage.setItem(SPEED_KEY, String(s)); } catch (err) { /* non-persistent session */ }
}
// A new game always starts on level 1; unlocked levels are reached via the
// level selector (or auto-advance after a win), never at boot.
let levelIndex = 0;
const game = new Game(buildPath(levelWaypoints(levelIndex)), levelIndex);
const renderer = new Renderer(canvas);

// Shared mutable view state (hover, placement mode, selection, mortar aiming,
// show-ranges toggle).
const view = { hoverCell: null, placingType: null, selectedTower: null, aimingMortar: null, showRanges: false };

// Restart button (shown only after a loss): restore the amount first started
// with for this level, plus $50 per retry attempt (the bonus stacks).
function restart(retry) {
  if (retry) {
    game.retryCount++;
    game.enterLevel(game.retry());
    game.setMessage(`Retry — starting money restored (+$${RETRY_BONUS * game.retryCount} retry bonus).`);
  } else {
    game.retryCount = 0;
    game.enterLevel(game.startMoney()); // this level's default (registry)
    game.setMessage('Place your first tower, then press ▶ Resume to start.');
  }
  view.placingType = null;
  view.selectedTower = null;
  view.aimingMortar = null;
  ui.renderTowerPanel(null);
  setPaused(true); // every level entry (switch, retry) starts paused
}

// Switch to a different level map: rebuild the path, reset everything.
// carryOver (win auto-advance only): unspent money is scaled by the TARGET
// level's difficulty (easy 100% / normal 75% / hard 50% / nightmare 25%) and
// ADDED to that level's default. Manual dropdown switches pass no flag —
// money resets to that level's default (current money is abandoned).
function loadLevel(i, carryOver) {
  if (i < 0 || i >= levelCount()) return;
  // Custom levels (created on the level generator page) are always playable.
  if (i >= progress.unlocked && !isCustomLevel(i)) {
    game.setMessage('Level locked — beat the previous level first.'); return;
  }
  const target = getLevel(i);
  // The level being ENTERED sets the carry-over fraction (not the one won).
  const carried = carryOver ? Math.floor(game.money * carryoverFactor(target.difficulty)) : 0;
  levelIndex = i;
  game.path = buildPath(target.waypoints);
  game.levelIndex = i;
  game.retryCount = 0; // a new level: no retry history carries over
  view.placingType = null; // tower unlocks differ per map level
  restart(false); // resets state + money to this level's default
  if (carryOver) {
    game.money += carried; // carry-over is ADDED on top of the default
    game.setMessage(`Level ${i + 1}: ${target.name} — $${carried} carried over!`);
  } else {
    game.setMessage(`Level ${i + 1}: ${target.name}`);
  }
  ui.syncLevelSelect(); // dropdown must follow the map we just loaded
}

// Level cleared: persist progression, then auto-advance to the next level.
function onWin() {
  if (levelIndex + 1 >= progress.unlocked) {
    progress.unlocked = Math.min(levelCount(), levelIndex + 2);
    if (levelIndex === levelCount() - 1) progress.beatenAll = true;
    saveProgress(progress);
  }
  ui.refreshLevelSelect();
  game.winTimer = WIN_ADVANCE_DELAY;
}

const handlers = {
  onLevelChange(i) {
    loadLevel(i);
  },
  onPickType(type) {
    if (game.status !== 'playing') return;
    if (!isTowerAvailable(type, game.levelIndex)) {
      game.setMessage(`${TOWER_TYPES[type].name} unlocks on level ${TOWER_TYPES[type].unlockLevel}.`);
      return;
    }
    // Phase 29: the level's tower roster may restrict unlocked towers too.
    if (!isTowerAllowedOnLevel(type, game.levelIndex)) {
      game.setMessage(`${TOWER_TYPES[type].name} is not available on this level.`);
      return;
    }
    view.placingType = (view.placingType === type) ? null : type;
    view.selectedTower = null;
    view.aimingMortar = null; // picking a tower ends any mortar aim session
    ui.renderTowerPanel(null);
    game.setMessage(view.placingType
      ? `Placing ${type} — click a grass tile. Right-click / Esc cancels.`
      : 'Build cancelled.');
  },
  onSendWave() {
    if (game.building) return; // waves start with the first tower
    const r = game.sendNextWave();
    if (r) {
      game.money += r.bonus;
      game.setMessage(r.bonus > 0
        ? `Wave ${r.wave} sent early! +$${r.bonus} bonus.`
        : `Wave ${r.wave} incoming!`);
      SFX.play('horn'); // manual wave send
    }
  },
  onShowRanges() {
    view.showRanges = !view.showRanges;
    ui.syncShowRangesBtn();
    game.setMessage(view.showRanges ? 'Showing range circles for all towers.' : 'Range circles hidden (selected tower still shows its range).');
  },
  // Phase 44: difficulty selector — persist the per-level override, then reload
  // the current level so lives/wave scaling/HP apply immediately (paused start,
  // same path as a dropdown switch).
  onDifficulty(key) {
    if (!DIFFICULTY_KEYS.includes(key)) return;
    setLevelDifficulty(game.levelIndex, key);
    loadLevel(levelIndex);
    ui.refreshLevelSelect(); // option labels show the effective difficulty
    game.setMessage(`Difficulty: ${LG_DIFFICULTY[key].label} — lives and enemy HP rescaled.`);
  },
  // Phase 44: background music on/off switch (persisted like mute).
  onMusic() {
    const on = Music.toggle();
    ui.el.musicBtn.textContent = on ? '🎵 Music' : '🎵 Music: off';
    game.setMessage(on ? 'Music on.' : 'Music off.');
  },
  onSpeed() {
    speed = (speed === 1) ? 2 : (speed === 2 ? 3 : 1);
    saveSpeed(speed); // Phase 34: persist across reloads
    ui.el.speedBtn.textContent = `Speed: ${speed}x`;
  },
  onPause() {
    setPaused(!paused);
    game.setMessage(paused ? 'Paused. Click Resume to continue.' : 'Resumed.');
  },
  onUpgrade(tower) {
    if (game.upgradeTower(tower)) {
      game.setMessage(`Upgraded to level ${tower.level}.`);
      ui.renderTowerPanel(tower); // refresh stats, upgrade cost, or max-level state
    } else {
      game.setMessage('Not enough money to upgrade.');
    }
  },
  onSell(tower) {
    game.sellTower(tower);
    view.selectedTower = null;
    ui.renderTowerPanel(null);
    game.setMessage(`Sold for $${tower.sellValue()}.`);
  },
  onTargetMode(tower, mode) {
    if (!TARGET_MODES[mode]) return;
    tower.targetMode = mode;
    game.setMessage(`${defName(tower)} now targets: ${TARGET_MODES[mode]}.`);
  },
  onAmmo(tower, ammo) {
    const def = TOWER_TYPES[tower.type];
    if (!def.ammoTypes || !def.ammoTypes.includes(ammo)) return;
    tower.ammo = ammo;
    ui.renderTowerPanel(tower); // refresh the stats line (payload damage)
    game.setMessage(`Mortar loaded with ${TOWER_TYPES[ammo].name} shells.`);
  },
  onMortarRetarget(tower) {
    view.aimingMortar = tower;
    game.setMessage('Click any tile to set the Mortar target. Right-click / Esc cancels.');
  },
};

function defName(tower) { return TOWER_TYPES[tower.type].name; }

const ui = new UI(game, view, handlers, progress);
new Input(canvas, game, view, ui);

// First-time tutorial: shown once (localStorage), advances as the player
// performs each step; update() is a no-op after dismissal.
const tutorial = tutorialDone() ? null : new Tutorial();

// Game loop: fixed-timestep simulation, rendered every animation frame.
let speed = loadSpeed(); // Phase 34: restored from localStorage (default 1)
let paused = true; // levels start paused; the player resumes with ▶ / Space
const STEP = 1 / 120; // simulation seconds per tick
let acc = 0;
let last = performance.now();

function setPaused(p) {
  paused = p;
  ui.setPaused(paused);
}

// Every level starts paused (boot, switch, retry, auto-advance): the player
// must press ▶ Resume (or Space) to begin. `paused` is initialized true; this
// syncs the button label now that the UI exists. restart() re-pauses on every
// later level entry (loadLevel and the retry button both funnel through it).
setPaused(true);
// Phase 34: the button label must reflect the RESTORED speed (the HTML hardcodes "1x").
ui.el.speedBtn.textContent = `Speed: ${speed}x`;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // tab was backgrounded; don't fast-forward

  // Paused: freeze the simulation (and the win auto-advance), keep rendering.
  if (!paused) {
    acc += dt * speed;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
  }

  renderer.draw(game, view);
  ui.updateHUD();
  ui.syncShopSelection();
  ui.syncEnemyLegend(); // grey out enemy types not active on this map
  ui.syncWavePreview(); // next wave's composition while between waves
  ui.syncShowRangesBtn(); // keep the toggle label in sync with view.showRanges
  if (tutorial) tutorial.update(view, game);

  // Phase 44: background music — real-time clock (unaffected by pause/speed),
  // boss mode while a Colossus is on screen.
  Music.update(dt, game.status === 'playing' && game.enemies.some(e => e.type === 'boss'));

  if (game.status !== lastStatus) {
    lastStatus = game.status;
    if (game.status === 'won' || game.status === 'lost') {
      // Level end: persist the per-level best, then show it on the banner.
      const final = game.endScore();
      const best = recordScore(game.levelIndex, final.score);
      const bestLine = best > 0 ? ` — Best: ${best.toLocaleString('en-US')}` : '';
      if (game.status === 'won') {
        game.setMessage(`🏆 Victory! All waves cleared. Score: ${final.score.toLocaleString('en-US')}${bestLine}`, 9999);
        SFX.play('fanfare'); // victory fanfare
        onWin();
      } else {
        game.setMessage(`💀 Defeated! Click Restart to try again. Score: ${final.score.toLocaleString('en-US')}${bestLine}`, 9999);
        SFX.play('sting'); // defeat sting
      }
    }
    ensureRestartButton();
  }

  // Auto-advance to the next level after the victory banner delay.
  if (!paused && game.status === 'won' && game.winTimer > 0) {
    game.winTimer -= dt; // real seconds, independent of speed multiplier
    // Win auto-advance carries unspent money over to the next level.
    if (game.winTimer <= 0 && levelIndex + 1 < levelCount()) loadLevel(levelIndex + 1, true);
  }

  requestAnimationFrame(frame);
}

let lastStatus = 'playing';

let restartBtn = null;
function ensureRestartButton() {
  if (restartBtn) return;
  restartBtn = document.createElement('button');
  restartBtn.className = 'tower-btn';
  restartBtn.textContent = 'Restart';
  restartBtn.addEventListener('click', () => restart(true)); // retry: initial + stacked $50 bonus
  document.getElementById('hud').appendChild(restartBtn);
}

requestAnimationFrame(frame);
