// Game state: money/lives, entity lists, update orchestration, win/lose.

const TOWER_COSTS = Object.fromEntries(
  Object.entries(TOWER_TYPES).map(([k, v]) => [k, v.cost])
);

// Phase 34: death-animation duration (seconds). A killed enemy leaves a
// shrinking/fading "corpse" disc for this long. Kept as its own list
// (game.corpses), NOT game.effects — tests assert exact effects indices.
const DEATH_ANIM = 0.15;

class Game {
  constructor(path, levelIndex = 0) {
    this.path = path;
    this.levelIndex = levelIndex; // which map (0-based) this game is running
    this.retryCount = 0;          // consecutive losses on the CURRENT level
    this.enterLevel(this.startMoney());
  }

  // This level's registry def, or null when the registry isn't loaded (legacy
  // smoke bundles). Registry is the single source of truth in the real game.
  levelDef() {
    return typeof getLevel === 'function' ? getLevel(this.levelIndex) : null;
  }

  // This level's default starting money (registry; falls back to the table).
  startMoney() {
    const lvl = this.levelDef();
    return lvl ? lvl.startMoney : levelStartMoney(this.levelIndex);
  }

  // Starting lives from the level's EFFECTIVE difficulty row (Phase 44: player
  // override or built-in key; falls back to START_LIVES when the registry or
  // row is missing — legacy smoke bundles).
  startingLives() {
    const diffKey = (typeof effectiveDifficulty === 'function')
      ? effectiveDifficulty(this.levelIndex) : null;
    return (diffKey && LG_DIFFICULTY[diffKey].lives) || START_LIVES;
  }

  // The level's EFFECTIVE difficulty key, defensive for legacy smoke bundles
  // that don't load config.js's resolver (falls back to 'normal').
  effectiveDiffKey() {
    return (typeof effectiveDifficulty === 'function')
      ? effectiveDifficulty(this.levelIndex) : 'normal';
  }

  // Enter a level with an explicit money base: fresh start, carry-over after a
  // win (target default + unspent), or a retry (initial start + stacked bonus).
  enterLevel(base) {
    this.money = base;
    this.reset();
  }

  // Money to restore when retrying the current level: the amount first started
  // with, plus RETRY_BONUS per attempt (stacks across consecutive losses).
  retry() {
    return this.startMoney() + RETRY_BONUS * this.retryCount;
  }

  // Reset everything except money (money is set by enterLevel/retry paths).
  reset() {
    this.lives = this.startingLives();
    this.enemies = [];
    this.towers = new Map(); // key "cx,cy" -> Tower
    this.projectiles = [];
    this.shots = [];          // in-flight railgun slugs (PiercingShot)
    this.effects = [];        // transient visuals (chain lightning segments, etc.)
    this.corpses = [];        // Phase 34: fading death discs (separate from effects)
    // Water ponds: deterministic per (level, effective difficulty) — rebuilt on
    // every level entry/retry/difficulty change so the layout always matches.
    this.ponds = (typeof buildPonds === 'function')
      ? buildPonds(this.levelIndex, this.effectiveDiffKey(), this.path) : null;
    const lvl = this.levelDef(); // per-level wave count + explicit waves
    this.waves = new WaveManager(this.levelIndex, lvl ? lvl.totalWaves : TOTAL_WAVES, lvl ? lvl.waves : null);
    this.status = 'playing'; // playing | won | lost
    this.building = true;    // paused: waves start when the first tower is placed
    this.winTimer = 0;       // countdown to auto-advance after a win (real seconds)
    this.message = '';
    this.messageTimer = 0;
    // Score inputs (kills/moneyEarned/wavesSurvived) plus Phase-35 tracking:
    // damageDealt (effective, post-resistance), towers built/sold, enemies
    // leaked, and the DoT-vs-direct kill split (dotKills + directKills === kills).
    this.stats = { kills: 0, moneyEarned: 0, wavesSurvived: 0,
      damageDealt: 0, towersBuilt: 0, towersSold: 0, towersDestroyed: 0,
      leaked: 0, dotKills: 0, directKills: 0 };
    this.speedMult = 1.0; // Phase 59: set by main.js each frame (speed income bonus)
    this._cache = null;
  }

  // Live score (see js/score.js): kills × 10 + lives × 50 + moneyEarned × 1.
  get score() {
    return computeScore({ ...this.stats, lives: this.lives });
  }

  // Snapshot at level end for the victory/defeat banner.
  endScore() {
    return {
      kills: this.stats.kills,
      lives: this.lives,
      moneyEarned: this.stats.moneyEarned,
      wavesSurvived: this.stats.wavesSurvived,
      score: this.score,
    };
  }

  setMessage(text, seconds = 3) {
    this.message = text;
    this.messageTimer = seconds;
  }

  get enemiesById() {
    if (!this._cache) {
      this._cache = new Map();
      for (const e of this.enemies) this._cache.set(e.id, e);
    }
    return this._cache;
  }

  // --- player actions -------------------------------------------------

  // Phase 55: type-aware water rule. `typeName` (optional) selects the tower
  // being placed — waterOnly towers (Cruiser) REQUIRE a pond cell; every other
  // tower is rejected on water. Without typeName, water stays rejected (the
  // legacy behavior) so old call sites are unaffected.
  canPlace(cx, cy, typeName) {
    if (cx < 0 || cx >= GRID.cols || cy < 0 || cy >= GRID.rows) return false;
    if (this.towers.has(key(cx, cy))) return false;
    const water = typeof isWaterCell === 'function' && isWaterCell(this.ponds, cx, cy);
    const def = typeName ? TOWER_TYPES[typeName] : null;
    if (water !== !!(def && def.waterOnly)) return false;
    return !isPathCell(this.path, cx, cy);
  }

  // Next Warden placement cost: $300 for the first, +$100 per existing Warden.
  wardenCost() {
    let n = 0;
    for (const t of this.towers.values()) if (t.type === 'warden') n++;
    return wardenPlacementCost(n);
  }

  placeTower(typeName, cx, cy) {
    const def = TOWER_TYPES[typeName];
    // Warden: dynamic cost ($300 first, +$100 each additional).
    const cost = def && def.dynamicCost ? this.wardenCost() : TOWER_COSTS[typeName];
    // Roster-aware gate: unlockLevel AND the level's tower roster (Phase 29).
    if (!cost || !isTowerAllowedOnLevel(typeName, this.levelIndex)) return false;
    if (this.money < cost || !this.canPlace(cx, cy, typeName)) return false; // Phase 55: water rule
    this.money -= cost;
    const tower = new Tower(typeName, cx, cy);
    if (def.dynamicCost) {
      tower.invested = cost; // sell refund tracks the real cost
      tower.hp = tower.maxHp; // Phase 54: durability follows the real cost
    }
    this.towers.set(key(cx, cy), tower);
    this.stats.towersBuilt++; // Phase 35: only counts successful placements
    if (this.building) this.startIfReady(); // first tower un-pauses the level
    return true;
  }

  // Leave the build phase: wave 1 starts immediately.
  startIfReady() {
    if (!this.building || this.status !== 'playing') return null;
    this.building = false;
    const r = this.waves.startNext(this, true);
    if (r) {
      this.stats.wavesSurvived = Math.max(this.stats.wavesSurvived, r.wave);
      this.setMessage(`Wave ${r.wave} incoming!`);
      SFX.play('horn'); // wave start fanfare call
    }
    return r;
  }

  // Manual "Send Next Wave": early-send bonus is earned money.
  sendNextWave() {
    const r = this.waves.startNext(this, false);
    if (!r) return null;
    this.stats.wavesSurvived = Math.max(this.stats.wavesSurvived, r.wave);
    // Phase 59: the bonus is EARNED money — it carries the speed income bonus.
    if (r.bonus > 0) this.stats.moneyEarned += r.bonus * this.speedMult;
    return r;
  }

  upgradeTower(tower) {
    const cost = tower.upgradeCost();
    if (cost == null || this.money < cost) return false;
    this.money -= cost;
    const hpBefore = tower.maxHp; // Phase 54: heal by the durability delta
    tower.invested += cost;
    tower.level++;
    tower.hp += tower.maxHp - hpBefore;
    return true;
  }

  sellTower(tower) {
    this.money += tower.sellValue();
    this.towers.delete(key(tower.cx, tower.cy));
    this.stats.towersSold++; // Phase 35
  }

  // Phase 54: friendly fire. Flat HP damage only — no resistance, DoT, or
  // AoE. Destruction removes the tower with NO sell refund (the loss is the
  // penalty) and leaves a death disc + message so it reads as an explosion.
  damageTower(tower, amount) {
    if (!tower.alive) return;
    tower.hp -= amount;
    if (tower.hp > 0) return;
    tower.alive = false;
    this.towers.delete(key(tower.cx, tower.cy));
    this.stats.towersDestroyed++;
    this.corpses.push({ x: tower.x, y: tower.y, radius: TOWER_HIT_RADIUS, color: tower.def.color, timer: DEATH_ANIM });
    SFX.play('boom');
    this.setMessage(`${tower.def.name} destroyed by friendly fire!`);
  }

  // --- events from systems --------------------------------------------

  onEnemyKilled(enemy) {
    const reward = enemy.def.reward * this.speedMult; // Phase 59: speed income bonus
    this.money += reward;
    this.stats.kills++;
    // Phase 35: DoT vs direct split. A kill is DoT when the enemy still has
    // an active burn or poison — DoT deaths arrive via the 'burned' state
    // (timers set), and every direct-kill path (impact, slug, chain, mortar)
    // calls here with the DoTs already applied, so the flag is reliable.
    if (enemy.burnTimer > 0 || enemy.poisonTimer > 0) this.stats.dotKills++;
    else this.stats.directKills++;
    this.stats.moneyEarned += reward; // total income, not balance
    SFX.play('pop'); // enemy death
    // Phase 34: death animation — a shrinking/fading disc at the kill spot.
    // Covers every non-leak cause (hits, splash, DoT, chain, mortar, railgun)
    // because they all funnel through here. Leaks get no corpse.
    this.corpses.push({ x: enemy.pos.x, y: enemy.pos.y, radius: enemy.def.radius, color: enemy.def.color, timer: DEATH_ANIM });
    // Fission: split into children at the death position (any kill cause).
    if (enemy.def.splits) {
      for (let i = 0; i < enemy.def.splits.count; i++) {
        const child = new Enemy(enemy.def.splits.key, this.waves.current, this.levelIndex);
        child.distance = enemy.distance; // exact path position of the parent
        child.pos = { x: enemy.pos.x, y: enemy.pos.y };
        child.game = this; // Phase 35: damage tracking needs the game ref
        this.enemies.push(child);
      }
    }
  }

  onEnemyLeaked(enemy) {
    this.stats.leaked++; // Phase 35
    this.lives -= enemy.def.livesCost;
    SFX.play('thud'); // enemy leaked past the end
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'lost';
    }
  }

  // --- main update ------------------------------------------------------

  update(dt) {
    if (this.status !== 'playing') return;
    if (this.building) return; // paused until the first tower is placed

    // Waves: spawn + auto-start.
    const spawns = this.waves.update(dt);
    for (const s of spawns) {
      if (s === '__auto__') {
        const r = this.waves.startNext(this, true);
        if (r) {
          this.stats.wavesSurvived = Math.max(this.stats.wavesSurvived, r.wave);
          this.message = `Wave ${r.wave} incoming!`;
          SFX.play('horn'); // auto wave start
        }
      } else {
        const e = new Enemy(s, this.waves.current, this.levelIndex);
        e.game = this; // Phase 35: damage tracking needs the game ref
        this.enemies.push(e);
      }
    }

    // Enemies.
    for (const e of this.enemies) {
      const state = e.update(dt, this.path);
      if (state === 'leaked') this.onEnemyLeaked(e);
      else if (state === 'burned') this.onEnemyKilled(e);
    }
    spreadFire(this.enemies, this); // burning enemies ignite enemies in contact
    mendAura(this.enemies, dt);     // menders heal nearby allies (not themselves)
    this.enemies = this.enemies.filter(e => e.alive);

    // Towers fire: homing projectiles, slugs, chain bolts, economy ticks.
    for (const t of this.towers.values()) {
      const spec = t.update(dt, this.enemies, this.path.total, wardenAuraMultiplier(this.towers, t));
      if (!spec) continue;
      if (spec.type === 'income') {
        // Mint: +$ every interval. Income is NOT counted toward stats.moneyEarned.
        // Phase 59: the speed income bonus applies to Mint ticks too.
        this.money += spec.amount * this.speedMult;
        continue;
      }
      SFX.play(FIRE_SOUND[t.type] || 'pew'); // per-tower fire sound
      if (spec.type === 'chain') applyChainLightning(this, spec); // instant bolt + hops
      else if (spec.type === 'mortar') this.projectiles.push(new MortarShell(spec));
      else if (spec.type === 'cruiser') this.projectiles.push(new CruiserMissile(spec, t)); // Phase 55
      else if (spec.pierce) this.shots.push(new PiercingShot(spec));
      else this.projectiles.push(new Projectile(spec));
    }

    // Transient effects (chain lightning segments) fade out.
    for (const fx of this.effects) fx.timer -= dt;
    this.effects = this.effects.filter(fx => fx.timer > 0);

    // Phase 34: death discs shrink/fade out (same tick as the other visuals).
    for (const c of this.corpses) c.timer -= dt;
    this.corpses = this.corpses.filter(c => c.timer > 0);

    // Railgun slugs: fly straight, damage enemies they pass through.
    for (const s of this.shots) s.update(dt, this.enemies, this);
    this.shots = this.shots.filter(s => s.alive);

    // Projectiles. (game passed so homing shells can hit towers — Phase 54.)
    this._cache = null; // enemy set may change; rebuild lookup
    for (const p of this.projectiles) {
      const impact = p.update(dt, this.enemiesById, this);
      if (!impact) continue;
      if (p instanceof MortarShell) applyMortarBlast(impact, this.enemies, this);
      else applyImpact(impact, this.enemies, this);
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
    this.enemies = this.enemies.filter(e => e.alive);

    // Win check: all waves done, nothing left alive. Guarded by 'playing' so a
    // loss that landed earlier in THIS tick (last enemy of the final wave
    // leaking and draining the final life) is never overwritten — a 0-life
    // "win" was the Phase-51 balance-pass bug.
    if (this.status === 'playing' &&
        this.waves.current >= this.waves.totalWaves && !this.waves.inProgress && this.enemies.length === 0) {
      this.status = 'won';
    }

    // Transient message expiry.
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
  }
}
