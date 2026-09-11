// Entry point: wires game, renderer, UI, input; runs the game loop.

const canvas = document.getElementById('game');
let progress = loadProgress();
// A new game always starts on level 1; unlocked levels are reached via the
// level selector (or auto-advance after a win), never at boot.
let levelIndex = 0;
const game = new Game(buildPath(levelWaypoints(levelIndex)), levelIndex);
const renderer = new Renderer(canvas);

// Shared mutable view state (hover, placement mode, selection).
const view = { hoverCell: null, placingType: null, selectedTower: null };

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
  ui.renderTowerPanel(null);
  setPaused(true); // every level entry (switch, retry) starts paused
}

// Switch to a different level map: rebuild the path, reset everything.
// carryOver (win auto-advance only): unspent money is ADDED to the target
// level's default. Manual dropdown switches pass no flag — money resets to
// that level's default (current money is abandoned).
function loadLevel(i, carryOver) {
  if (i < 0 || i >= levelCount()) return;
  // Custom levels (created on the level generator page) are always playable.
  if (i >= progress.unlocked && !isCustomLevel(i)) {
    game.setMessage('Level locked — beat the previous level first.'); return;
  }
  const carried = carryOver ? game.money : 0; // unspent money from the level just won
  levelIndex = i;
  game.path = buildPath(getLevel(i).waypoints);
  game.levelIndex = i;
  game.retryCount = 0; // a new level: no retry history carries over
  view.placingType = null; // tower unlocks differ per map level
  restart(false); // resets state + money to this level's default
  if (carryOver) {
    game.money += carried; // carry-over is ADDED on top of the default
    game.setMessage(`Level ${i + 1}: ${getLevel(i).name} — $${carried} carried over!`);
  } else {
    game.setMessage(`Level ${i + 1}: ${getLevel(i).name}`);
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
    view.placingType = (view.placingType === type) ? null : type;
    view.selectedTower = null;
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
  onSpeed() {
    speed = (speed === 1) ? 2 : (speed === 2 ? 3 : 1);
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
};

function defName(tower) { return TOWER_TYPES[tower.type].name; }

const ui = new UI(game, view, handlers, progress);
new Input(canvas, game, view, ui);

// First-time tutorial: shown once (localStorage), advances as the player
// performs each step; update() is a no-op after dismissal.
const tutorial = tutorialDone() ? null : new Tutorial();

// Game loop: fixed-timestep simulation, rendered every animation frame.
let speed = 1;
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
  if (tutorial) tutorial.update(view, game);

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
