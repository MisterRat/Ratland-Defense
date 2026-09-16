// All canvas drawing: grid, path, towers, enemies, projectiles, preview.

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(game, view) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid(ctx);
    this.drawPath(ctx, game.path);
    for (const t of game.towers.values()) {
      this.drawTower(ctx, t, view.selectedTower === t);
      if (t.def.ammoTypes && t.targetPoint) this.drawMortarTarget(ctx, t);
    }
    const hoverPx = this.hoverPixel(view);
    for (const e of game.enemies) this.drawEnemy(ctx, e, hoverPx);
    this.drawCorpses(ctx, game.corpses); // Phase 34: fading death discs
    for (const p of game.projectiles) this.drawProjectile(ctx, p);
    this.drawShots(ctx, game.shots);
    this.drawEffects(ctx, game.effects);
    if (view.placingType) this.drawPlacementPreview(ctx, game, view);
    if (view.aimingMortar) this.drawMortarAimPreview(ctx, game, view);
    // "Show Ranges" toggle: range circles for EVERY placed tower at once.
    // When off, only the selected tower shows its range (no duplicate circle).
    if (view.showRanges) {
      for (const t of game.towers.values()) this.drawTowerRange(ctx, t);
    } else if (view.selectedTower) {
      this.drawTowerRange(ctx, view.selectedTower);
    }
  }

  // One tower's range indicator, by type: Warden → gold aura ring, Mortar →
  // blast circle at its impact point (when set), everything else → blue range.
  drawTowerRange(ctx, t) {
    const def = TOWER_TYPES[t.type];
    if (def.aura) this.drawAura(ctx, t.x, t.y, t.range);
    else if (def.ammoTypes && t.targetPoint) {
      this.drawRange(ctx, t.targetPoint.x, t.targetPoint.y, t.range);
    } else {
      this.drawRange(ctx, t.x, t.y, t.range);
    }
  }

  // Persistent marker at a Mortar's impact point: a small crosshair.
  drawMortarTarget(ctx, t) {
    const { x, y } = t.targetPoint;
    ctx.strokeStyle = 'rgba(255,215,106,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
    ctx.stroke();
  }

  // Mortar aim mode: blast-radius preview at the hovered cell. Phase 43: any
  // in-bounds cell is a valid target, so the preview is always green.
  drawMortarAimPreview(ctx, game, view) {
    if (!view.hoverCell) return; // mouse hasn't entered the canvas yet
    const { cx, cy } = view.hoverCell;
    if (cx < 0 || cx >= GRID.cols || cy < 0 || cy >= GRID.rows) return;
    const c = cellCenter(cx, cy, GRID.cell);
    ctx.fillStyle = 'rgba(103,212,111,0.18)';
    ctx.strokeStyle = 'rgba(103,212,111,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, view.aimingMortar.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Transient effects: chain lightning polylines and mortar explosion splashes.
  drawEffects(ctx, effects) {
    for (const fx of effects) {
      if (fx.type === 'chain') {
        const alpha = Math.max(0, fx.timer / (fx.duration || 0.15));
        ctx.strokeStyle = `rgba(105,240,255,${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (const s of fx.segments) {
          ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
        }
        ctx.stroke();
      } else if (fx.type === 'explosion') {
        // Mortar splash: an expanding ring + soft flash, colored by ammo type.
        const t = 1 - Math.max(0, fx.timer / fx.duration); // 0 -> 1 over life
        const r = fx.radius * (0.35 + 0.75 * t);
        const alpha = Math.max(0, fx.timer / fx.duration);
        ctx.fillStyle = hexA(fx.color, 0.22 * alpha);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexA(fx.color, 0.9 * alpha);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Warden aura: a warm gold ring (distinct from the blue targeting range).
  drawAura(ctx, x, y, range) {
    ctx.fillStyle = 'rgba(255,215,106,0.10)';
    ctx.strokeStyle = 'rgba(255,215,106,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Pixel position under the hovered grid cell (null when off-grid).
  hoverPixel(view) {
    const c = view.hoverCell;
    if (!c || c.cx < 0 || c.cx >= GRID.cols || c.cy < 0 || c.cy >= GRID.rows) return null;
    return cellCenter(c.cx, c.cy, GRID.cell);
  }

  drawGrid(ctx) {
    const { cols, rows, cell } = GRID;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        ctx.fillStyle = (cx + cy) % 2 === 0 ? '#232b36' : '#1f2731';
        ctx.fillRect(cx * cell, cy * cell, cell, cell);
      }
    }
  }

  drawPath(ctx, path) {
    ctx.strokeStyle = '#5a4a33';
    ctx.lineWidth = GRID.cell * 0.72;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(path.points[0].x, path.points[0].y);
    for (let i = 1; i < path.points.length; i++) {
      ctx.lineTo(path.points[i].x, path.points[i].y);
    }
    ctx.stroke();
    ctx.strokeStyle = '#6f5b3e';
    ctx.lineWidth = GRID.cell * 0.4;
    ctx.stroke();
  }

  drawTower(ctx, t, selected) {
    const def = TOWER_TYPES[t.type];
    const r = GRID.cell * 0.36;
    // Base plate
    ctx.fillStyle = '#151a21';
    ctx.beginPath();
    ctx.arc(t.x, t.y, r + 4, 0, Math.PI * 2);
    ctx.fill();
    if (selected) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Body: sprite if loaded, else procedural circle fallback.
    const sprite = typeof TowerAssets !== 'undefined' ? TowerAssets.get(t.type) : null;
    if (sprite) {
      const s = GRID.cell * 0.88; // ~44px of the 50px cell
      ctx.drawImage(sprite, t.x - s / 2, t.y - s / 2, s, s);
    } else {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Level pips (white — tower sprites are dark)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < t.level; i++) {
      ctx.beginPath();
      ctx.arc(t.x - 8 + i * 8, t.y + r * 0.55, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemy(ctx, e, hoverPx) {
    const slowed = e.slowTimer > 0;
    // Phased (untargetable) wisps are drawn as an unfilled ring so the state
    // reads at a glance; solid enemies keep the filled disc.
    const phased = !!e.def.phase && !e.targetable;
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, e.def.radius, 0, Math.PI * 2);
    if (!phased) {
      // Poisoned enemies tint green (mirroring the Frost slow's blue tint);
      // poison wins when both are active.
      const poisoned = e.poisonTimer > 0;
      ctx.fillStyle = poisoned ? '#9fff8f' : (slowed ? '#9fd8ff' : e.def.color);
      ctx.fill();
    }
    ctx.strokeStyle = phased ? e.def.color : 'rgba(0,0,0,.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (e.burning) this.drawFlames(ctx, e);
    // HP bar
    const w = e.def.radius * 2;
    const frac = e.hp / e.maxHp;
    ctx.fillStyle = '#11151a';
    ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.def.radius - 9, w, 5);
    ctx.fillStyle = frac > 0.5 ? '#67d46f' : (frac > 0.25 ? '#ffd76a' : '#e5533d');
    ctx.fillRect(e.pos.x - w / 2, e.pos.y - e.def.radius - 9, w * frac, 5);
    // Hover tooltip: enemy name + what it resists.
    if (hoverPx && dist(hoverPx.x, hoverPx.y, e.pos.x, e.pos.y) < 30) {
      const lines = [e.def.name];
      if (e.def.resist.length) {
        lines.push('resists ' + e.def.resist.map(k => TOWER_TYPES[k].name).join(', '));
      }
      ctx.font = 'bold 12px system-ui, sans-serif';
      const w0 = ctx.measureText(lines[0]).width;
      ctx.font = '11px system-ui, sans-serif';
      const w1 = lines.length > 1 ? ctx.measureText(lines[1]).width : 0;
      const bw = Math.max(w0, w1) + 8;
      const bh = lines.length > 1 ? 30 : 15;
      const bx = e.pos.x - bw / 2, by = e.pos.y - e.def.radius - 9 - bh - 3;
      ctx.fillStyle = 'rgba(10,13,17,0.85)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.textAlign = 'center';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillStyle = '#dfe6ee';
      ctx.fillText(lines[0], e.pos.x, by + 12);
      if (lines.length > 1) {
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillStyle = '#ffd76a';
        ctx.fillText(lines[1], e.pos.x, by + 25);
      }
      ctx.textAlign = 'left';
    }
  }

  // Flickering flames above a burning enemy (deterministic, time-based).
  drawFlames(ctx, e) {
    const t = performance.now() / 1000;
    const r = e.def.radius;
    const flames = [
      { dx: -r * 0.5, hue: '#ff8c42', h: r * 0.9, ph: 0 },
      { dx: 0, hue: '#ffd76a', h: r * 1.3, ph: 1.7 },
      { dx: r * 0.5, hue: '#ff6b35', h: r * 1.0, ph: 3.1 },
    ];
    for (const f of flames) {
      const flick = 0.8 + 0.2 * Math.sin(t * 14 + f.ph);
      const fh = f.h * flick;
      ctx.fillStyle = f.hue;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(e.pos.x + f.dx - r * 0.3, e.pos.y - r * 0.4);
      ctx.quadraticCurveTo(e.pos.x + f.dx - r * 0.2, e.pos.y - r * 0.4 - fh, e.pos.x + f.dx, e.pos.y - r * 0.4 - fh * 1.35);
      ctx.quadraticCurveTo(e.pos.x + f.dx + r * 0.2, e.pos.y - r * 0.4 - fh, e.pos.x + f.dx + r * 0.3, e.pos.y - r * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Phase 34: death animation — each corpse is a filled disc that scales down
  // and fades out over its remaining life (alpha tracks the scale).
  drawCorpses(ctx, corpses) {
    if (!corpses || !corpses.length) return;
    for (const c of corpses) {
      const t = Math.max(0, c.timer / DEATH_ANIM); // 1 -> 0 over the lifetime
      ctx.globalAlpha = t;
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawProjectile(ctx, p) {
    // Mortar shells lob in an arc: draw them above their ground position and
    // leave a small shadow on the ground to sell the height.
    if (p instanceof MortarShell) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3f47';
      ctx.beginPath();
      ctx.arc(p.x, p.y - p.arc, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      return;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Railgun slugs: a short thin tracer along the velocity plus a bright head
  // dot — reads as a small fast dart, not a laser line.
  drawShots(ctx, shots) {
    for (const s of shots) {
      const tail = 24; // tracer length in px
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - s.ux * tail, s.y - s.uy * tail);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRange(ctx, x, y, range) {
    ctx.fillStyle = 'rgba(120,170,255,0.10)';
    ctx.strokeStyle = 'rgba(120,170,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawPlacementPreview(ctx, game, view) {
    const { cell } = GRID;
    if (!view.hoverCell) return; // mouse hasn't entered the canvas yet
    const { cx, cy } = view.hoverCell;
    if (cx < 0 || cx >= GRID.cols || cy < 0 || cy >= GRID.rows) return;
    const ok = game.canPlace(cx, cy);
    const def = TOWER_TYPES[view.placingType];
    const x = (cx + 0.5) * cell, y = (cy + 0.5) * cell;
    ctx.fillStyle = ok ? 'rgba(103,212,111,0.25)' : 'rgba(229,83,61,0.3)';
    ctx.fillRect(cx * cell, cy * cell, cell, cell);
    if (ok) this.drawRange(ctx, x, y, def.range);
  }
}
