I've reviewed all 28 JS files, both HTML pages, the build tool, level files, all 7 plan documents, the security audit, and run the full test suite (31/31 passing). Here's my report:

---

# Tower Defense — Improvement & Feature Report

## Current State Summary

| Metric | Value |
|--------|-------|
| JS files | 28 (all ≤ 500 lines; largest: render.js 332, ui.js 330) |
| Total JS lines | 3,965 |
| Tower types | 12 (6 base + 5 Phase-26 + Mortar) |
| Enemy types | 13 (6 base + 5 Phase-19 + Colossus) |
| Built-in levels | 6 + 1 external (Riverbend) + custom (localStorage) |
| Smoke tests | 31 passing / 0 failing |
| Latest phase | 31 (Mortar no-resistance + playfield fix) |

---

## A. Open Security Findings (from `SECURITY_AUDIT.md`)

These are documented proposals that have **not yet been applied**:

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| M-1 | Medium | Unbounded waypoint count → O(n²) validation DoS | Cap waypoints at ~200 in `validateWaypoints` |
| L-1 | Low | `totalWaves` has no upper bound | Cap at 50 in `validateOptionalFields` |
| L-2 | Low | Enemy keys in `waves` not whitelisted at validation time | Check against `ENEMY_TYPES` keys |
| I-2 | Info | `lgCreateLevels` saves before validating | Reorder: validate → save |
| I-3 | Info | No guard in `Enemy` constructor for bad `levelIndex` | One-line clamp |

**Recommendation:** Apply M-1 + L-1 + L-2 as a single small security hardening phase. These are 3–5 lines each and close the only real DoS vector.

---

## B. Code Quality & Dead Code

| Item | Location | Note |
|------|----------|------|
| `EARLY_SEND_BONUS_PER_SEC` | `config.js:31` | Defined but never referenced. The actual bonus is `Math.floor(waitTimer)` in `wave.js:92`. Either wire it in or remove the constant. |
| `MAX_LEVEL = 3` | `config.js:28` | Redundant — `tower.js:32` derives max level from `UPGRADE_COST_FACTOR.length + 1`. Keep one source of truth. |
| Commented-out barrel code | `render.js:165–171` | Dead code; remove or implement. |
| `SLOW.factor` / `SLOW.duration` | `config.js:205` | Used by Frost and Mortar-frost payloads. Fine, but the Mortar path hardcodes `{ factor: SLOW.factor, duration: SLOW.duration }` in `tower.js:107` rather than reading from the Frost def — a future change to Frost slow would silently not affect Mortar frost ammo. |

---

## C. Balance Observations

### Tower Economy
- **Mint** (+$10/8s = $1.25/s base, $25/8s at L3) has a 120-second payback at base level. At L3 it's ~48s. Reasonable but the "income does NOT count toward score" rule means it's purely a win-condition enabler, not a score play. Consider a small score credit (e.g., ×0.5) so it doesn't feel like dead weight in the score formula.
- **Warden** (+25% damage, fixed multiplier regardless of tower level) — at L3 a Warden still gives +25%, not +25% × 2.5. This is by design (it's an aura, not a damage tower), but the dynamic cost ($300/$400/$500…) means a third Warden costs $500 for the same flat +25%. The multiplicative stacking (1.25 × 1.25 = 1.5625) is the real value; the UI could surface "combined multiplier: ×1.56" to help players understand the compounding.
- **Mortar** is the *only* counter to Colossus (11/12 resist list). This makes it essential for boss waves but also means a player who doesn't build a Mortar has no answer. Consider either: (a) giving Colossus a small flat vulnerability (e.g., 50% damage from all towers) so non-Mortar strategies can still chip it, or (b) adding a "boss wave incoming" warning so players have time to reposition.

### Enemy Scaling
- HP scaling is linear: `1 + (wave-1) × 0.22`. At wave 12 that's ×3.42. Combined with difficulty `hpMul` (up to 1.35 on Nightmare), a wave-12 Colossus on Nightmare has 900 × 3.42 × 1.35 ≈ **4,160 HP**. With no resist on Mortar and a L3 Mortar doing 26 × 2.5 = 65 damage per shell every 4s, that's ~254 seconds to kill one Colossus with a single maxed Mortar. This is likely too long for a boss that also has escorts. A balance pass on boss HP or Mortar damage scaling would help.

### Wave Composition
- Procedural waves use round-robin type assignment. On levels with 6+ enemy types, the composition can feel random rather than curated. The explicit `waves` array (used by generated levels) solves this, but built-in levels 1–6 still use the procedural generator. Consider hand-authoring wave lists for the built-in levels to create deliberate pacing (e.g., a "fast wave" of all Skitterers, a "tank wave" of all Tankeds).

---

## D. Feature Recommendations (prioritized)

### Tier 1 — High Impact, Low Effort

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| 1 | **Wave preview** | S | Show the next wave's enemy composition (icons + counts) in the HUD before sending. Players can plan tower placement. Data is already available from `buildWave()`. |
| 2 | **"Show all ranges" toggle** | S | A button that draws range circles for every placed tower simultaneously. Currently only the selected tower shows its range. Essential for planning Warden/Mortar placement. |
| 3 | **Boss wave warning** | S | When the next wave contains a Colossus, show a "⚠️ BOSS INCOMING" banner 3 seconds before it starts (use the existing `message` system or a dedicated HUD element). Gives players time to focus fire. |
| 4 | **Security hardening** (M-1, L-1, L-2) | S | 3–5 lines in `level_validate.js`. Closes the only real DoS vector. |
| 5 | **Remove dead code** (`EARLY_SEND_BONUS_PER_SEC`, `MAX_LEVEL`, commented barrel) | XS | Hygiene. |

### Tier 2 — Medium Impact, Medium Effort

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| 6 | **Enemy death animation** | M | Currently enemies vanish instantly. A brief scale-down + fade (0.15s) would make kills feel satisfying and give visual feedback for chain lightning / mortar blasts. Reuse the existing `effects` array pattern. |
| 7 | **Tower upgrade preview** | M | When hovering the Upgrade button, show a small tooltip: "L2: dmg 19 · rng 168 · 3.0/s" (calculated from `LEVEL_SCALE`). Helps players decide whether to upgrade or save for a new tower. |
| 8 | **Persistent game speed** | S | Save the selected speed (1×/2×/3×) in localStorage alongside mute. Currently resets to 1× on every reload. |
| 9 | **Hand-authored waves for built-in levels** | M | Replace the procedural generator for levels 1–6 with explicit wave arrays. Creates deliberate difficulty curves and introduces enemy types at specific waves (e.g., first Bolt on wave 4 of level 5). The infrastructure already exists (`waves` field in level defs). |
| 10 | **Level share/export** | M | A "Share" button that copies a level's JSON to clipboard (or generates a short URL-encoded string). Pairs with the existing import flow. Makes the generator more social. |

### Tier 3 — Higher Impact, Higher Effort

| # | Feature | Effort | Why |
|---|---------|--------|-----|
| 11 | **Difficulty selector for built-in levels** | M | Currently only external/custom levels carry a `difficulty` field. Adding a difficulty dropdown (Easy/Normal/Hard/Nightmare) to the level select would let players replay built-in maps at different intensities. The `LG_DIFFICULTY` rows already drive all the levers (hpMul, spawnGap, lives, bossEvery). |
| 12 | **Tower sell → rebuild in place** | S | When selling a tower, keep the placement mode active for that tower type so the player can immediately reposition. Reduces click-count for common "oops, wrong spot" moments. |
| 13 | **Stats panel** | M | Expand `game.stats` to track: total damage dealt, towers built, towers sold, enemies leaked, DoT kills vs direct kills. Show on the victory/defeat banner alongside score. Gives players insight into their playstyle. |
| 14 | **More path templates** | M | The generator has 5 templates (arc, sbend, loop, weave, crossroads). Adding 2–3 more (e.g., "spiral" — a tightening spiral; "figure-8" — two overlapping loops; "comb" — multiple parallel lanes with cross-links) would increase variety. Each is ~15 lines in `levelgen_paths.js`. |
| 15 | **Background music** | M | A simple looping chiptune track (generated via Web Audio, same pattern as SFX) that plays during gameplay and changes tempo/intensity during boss waves. The SFX engine already has the lazy-init + mute infrastructure. |
| 16 | **Tower "focus fire" mode** | L | A global toggle: when active, all towers target the same enemy (the one furthest along). Useful for quickly eliminating a single tough enemy before it leaks. Changes `acquireTarget` to a shared target ID. |

### Tier 4 — Stretch / Long-term

| # | Feature | Notes |
|---|---------|-------|
| 17 | **Mobile/touch support** | Touch events for placement/selection; responsive canvas scaling. Significant layout work. |
| 18 | **Daily challenge** | A seeded random level (using the generator's `mulberry32` with a date-derived seed) that all players get the same level on a given day. Score leaderboard via localStorage (local only, no server). |
| 19 | **Achievement/badge system** | "Kill 100 Colossuses", "Clear a level without selling", "Build all 12 tower types on one level". Persist in localStorage; show as small icons in the HUD. |
| 20 | **Level editor (in-browser)** | The generator creates random paths. A full editor where players hand-place waypoints on a grid canvas, drag to create paths, and click cells to assign waves would be a major feature. The validation infrastructure already exists. |

---

## E. Architecture Notes

1. **The `effects` array is the right pattern for transient visuals.** Chain lightning, mortar explosions, and (future) death animations all push into `game.effects` with a `timer`/`duration` pair. Keep this pattern; don't add per-entity animation state.

2. **The spec-object dispatch in `tower.js → game.js` is clean but growing.** There are now 5 spec types (`chain`, `income`, `mortar`, `pierce`, default homing). If more tower types are added, consider a registry pattern (`TOWER_BEHAVIORS[type] = { update, fire }`) to keep `tower.js` from growing. Not urgent at 12 towers, but worth noting before reaching ~15.

3. **The `enemiesById` cache is rebuilt every frame** (line 245 of `game.js`: `this._cache = null`). With 100+ enemies this is a small allocation each tick. A dirty-flag approach (only rebuild when the enemy list changes) would avoid it, but at current scale it's negligible.

4. **File dependency order is fragile.** The 28 `<script>` tags in `index.html` must load in a specific order (config → assets → levels → validate → registry → … → main). A single misplaced tag breaks the game silently. Consider adding a boot-time assertion in `main.js` that checks all expected globals exist and logs a clear error if one is missing.

---

## F. Recommended Next Phases (in order)

| Phase | Scope | Files touched |
|-------|-------|---------------|
| **32** | Security hardening (M-1, L-1, L-2) + dead code removal | `level_validate.js`, `config.js`, `render.js` |
| **33** | Wave preview + "show all ranges" toggle + boss warning | `ui.js`, `render.js`, `main.js`, `index.html` |
| **34** | Enemy death animation + persistent speed + sell→rebuild | `game.js`, `render.js`, `main.js`, `input.js`, `progress.js` |
| **35** | Hand-authored waves for built-in levels 1–6 | `levels.js` (or new `js/levels_waves.js`) |
| **36** | Balance pass: boss HP / Mortar scaling / Mint score credit | `config.js`, `score.js` |

Each phase is small enough to complete in a single sitting with full regression.