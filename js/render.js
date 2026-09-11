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
    for (const t of game.towers.values()) this.drawTower(ctx, t, view.selectedTower === t);
    const hoverPx = this.hoverPixel(view);
    for (const e of game.enemies) this.drawEnemy(ctx, e, hoverPx);
    for (const p of game.projectiles) this.drawProjectile(ctx, p);
    this.drawShots(ctx, game.shots);
    if (view.placingType) this.drawPlacementPreview(ctx, game, view);
    if (view.selectedTower) this.drawRange(ctx, view.selectedTower.x, view.selectedTower.y, view.selectedTower.range);
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
    // Barrel (commented out — sprites don't rotate; keep for possible reuse)
    // ctx.strokeStyle = def.color;
    // ctx.lineWidth = 7;
    // ctx.beginPath();
    // ctx.moveTo(t.x, t.y);
    // ctx.lineTo(t.x + Math.cos(t.angle) * (r + 6), t.y + Math.sin(t.angle) * (r + 6));
    // ctx.stroke();
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
    ctx.fillStyle = slowed ? '#9fd8ff' : e.def.color;
    ctx.beginPath();
    ctx.arc(e.pos.x, e.pos.y, e.def.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
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

  drawProjectile(ctx, p) {
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
