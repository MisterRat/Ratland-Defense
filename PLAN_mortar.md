# PLAN_mortar — Mortar tower (design record)

Status: **IMPLEMENTED in Phase 27** (approved by user; full suite 29/29 PASS).

A 12th tower: a slow, expensive, map-wide artillery piece. It does NOT lock
onto a target — the player picks a **path cell** as the impact point. The Mortar
is dumb: it fires at that fixed point on its cooldown timer, regardless of
whether enemies are there. Every enemy inside the blast radius takes the
damage + effect of the selected ammo type.

## Stats

```js
mortar: {
  name: 'Mortar', cost: 400, color: '#b08968', unlockLevel: 7, img: 'assets/mortar.png',
  range: 100,              // blast radius (L1); scales ×1/1.12/1.25 with upgrades
  damage: 0,               // no intrinsic damage — payload defines it
  fireRate: 0.25,          // 1 shell per 4s — slowest tower in the game
  projSpeed: 350,          // lobbed shell speed
  splash: 0,               // (unused; blast radius is `range`)
  slow: 0,
  ammoDefault: 'cannon',
  ammoTypes: ['cannon', 'flame', 'frost', 'tesla', 'venom'],
  desc: 'Lobs a shell at a chosen path point every 4s. Pick ammo in the panel.',
}
```

Upgrades use standard `LEVEL_SCALE`: blast radius ×1/1.12/1.25, payload damage
×1/1.6/2.5, fireRate ×1/1.2/1.45. Sell refund 70% of invested (standard).
Warden aura multiplies payload damage/burn/poison like every other tower.

## Firing rule (dumb, fire-and-forget)

- After placement, the player **must** click a path cell to set the impact
  point. Until then the Mortar does not fire.
- Once set, the Mortar fires at that fixed point on every cooldown tick —
  **regardless of whether any enemy is there**. It never re-aims.
- A **"Retarget" button** in the tower panel enters aim mode for one click;
  the next path-cell click moves the impact point. Esc / right-click cancels.
- The impact point must be a **path cell** (the path passes through it).

## Ammo payloads

Every shell deals the **ammo tower's own damage** (scaled by Mortar level +
Warden aura) to every enemy in the blast radius, then applies that tower's
effect:

| Ammo | Damage (L1) | Extra effect on everyone in the blast |
|---|---|---|
| Cannon | 26 | none (pure area damage) |
| Flame | 6 | burn 10 dps × level scale for 2.5s (fire then spreads via `spreadFire`) |
| Frost | 4 | 50% slow for 1.5s |
| Tesla | 18 | none extra — lightning lines drawn between all enemies in the blast (visual only, no chain outward) |
| Venom | 4 | poison stacks (5 cap, 6 dps/stack × level scale, 3s refresh) |

**Resistance:** the shell's `sourceType` is the **ammo key** (not `'mortar'`)
— so per-enemy resistance applies per flavor (a Singed resists Flame ammo, a
Colossus resists each flavor individually). No config change to boss resist
lists needed.

## UI

- Tower panel: for a Mortar, the "Target" dropdown is replaced by an **Ammo**
  dropdown (Cannon/Flame/Frost/Tesla/Venom), default Cannon. Changing it sets
  `tower.ammo`. A **"Retarget"** button enters aim mode.
- Shop card: standard cost + desc.

## Rendering

- Selected Mortar: blast-radius circle drawn at the **impact point** (not the
  tower position).
- Aim mode: crosshair + blast preview at the hovered path cell (green if valid,
  red if not a path cell).
- Tesla ammo blast: lightning lines between all in-blast enemies (fading
  `game.effects` entry, same style as chain lightning).
- Shell in flight: small dark circle with a parabolic arc offset (cosmetic).

## Implementation sketch

- `js/config.js` — def above (~10 lines).
- `js/tower.js` — `this.ammo = this.def.ammoDefault || null`;
  `this.targetPoint = null`; mortar branch in `update()`: if no targetPoint →
  null; if cooldown ready → return `{type:'mortar', tx, ty, ammo, damage,
  blastRadius, sourceType, slow, burn, poison, color}` (~15 lines).
- `js/tower_mortar.js` (new, ~80 lines) — `MortarShell` class (flies to fixed
  point; returns `{x, y}` on arrival) + `applyMortarBlast(impact, spec,
  enemies, game)` — splash loop + per-ammo payload (reuses
  `e.applyBurn/applySlow/applyPoison`; Tesla pushes visual-only chain lines).
- `js/game.js` — dispatch `{type:'mortar'}` → spawn `MortarShell` into
  `this.projectiles`; on impact call `applyMortarBlast` (~8 lines).
- `js/ui.js` — ammo dropdown + Retarget button in `renderTowerPanel`
  (~20 lines; file is ~295, cap 500 — fits).
- `js/input.js` — aim-mode handling: if `view.aimingMortar`, intercept click →
  validate path cell → set `tower.targetPoint` (~12 lines).
- `js/main.js` — `onRetarget(tower)` handler sets `view.aimingMortar`
  (~5 lines); view object gains `aimingMortar: null`.
- `js/render.js` — blast circle at impact point for selected mortar; aim-mode
  preview; Tesla blast lines in `drawEffects` (~15 lines).
- `js/sfx_sounds.js` — `FIRE_SOUND.mortar = 'boom'` (reuses existing `sfxBoom`).
- `assets/mortar.png` — 128×128 sprite via `tests/gen_tower_sprites.py`.
- `index.html` — `<script src="js/tower_mortar.js">` after `tower_warden.js`.

## Test plan — `tests/smoke_mortar.mjs`

- Config: def shape, `unlockLevel === 7`, slowest fireRate in roster.
- Firing: no targetPoint → no spec; with targetPoint + cooldown ready → spec
  with correct tx/ty/ammo/damage.
- Blast: two enemies inside radius both take falloff damage; enemy outside
  takes none.
- Ammo payloads: flame → burn on both in-radius; frost → slow on both; venom →
  poison stacks on both; tesla → damage on both + visual effect entry.
- Resistance: flame ammo vs Singed (resist `['flame']`) deals reduced damage.
- Warden aura: mortar payload ×1.25 inside an aura.
- Retarget: changing targetPoint moves the impact.
- Regression: `smoke_tower_unlock.mjs` counts 11 → 12; full suite green.

## Review decisions (settled)

1. **Unlock level** — L7 (consistent with the other five new towers).
2. **Fire condition** — fire regardless of enemies (dumb artillery).
3. **Damage model** — payload = ammo tower's own stats × Mortar level scale.
4. **Retarget UX** — "Retarget" button in panel → one-click aim mode.
5. **Area limits** — path cells only.
6. **Tesla ammo** — area damage only; lightning lines drawn between in-blast
   enemies (visual), no chain outward.
7. **Blast radius** — 100px base (~2 cells).
