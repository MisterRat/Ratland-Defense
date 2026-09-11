// Mouse/keyboard input: hover tracking, tower placement, selection, cancel.

class Input {
  constructor(canvas, game, view, ui) {
    this.canvas = canvas;
    this.game = game;
    this.view = view;
    this.ui = ui;
    canvas.addEventListener('mousemove', e => this.onMove(e));
    canvas.addEventListener('mousedown', e => this.onDown(e));
    canvas.addEventListener('contextmenu', e => { e.preventDefault(); this.cancel(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.cancel();
      // Space toggles pause (unless the user is typing in a control).
      else if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) {
        e.preventDefault();
        ui.handlers.onPause();
      }
    });
  }

  cellFromEvent(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    return cellOf(x, y, GRID.cell);
  }

  onMove(e) {
    this.view.hoverCell = this.cellFromEvent(e);
  }

  onDown(e) {
    if (e.button === 2) return; // handled by contextmenu
    const { cx, cy } = this.cellFromEvent(e);

    if (this.view.placingType) {
      const type = this.view.placingType;
      if (this.game.placeTower(type, cx, cy)) {
        this.view.placingType = null;
        this.view.selectedTower = this.game.towers.get(key(cx, cy));
        this.ui.renderTowerPanel(this.view.selectedTower);
      } else {
        this.game.setMessage('Cannot build there (path, occupied, or not enough money).');
      }
      return;
    }

    // No placement mode: select a tower under the cursor, or deselect.
    const tower = this.game.towers.get(key(cx, cy)) || null;
    this.view.selectedTower = tower;
    this.ui.renderTowerPanel(tower);
  }

  cancel() {
    if (this.view.placingType) {
      this.view.placingType = null;
      this.game.setMessage('Build cancelled.');
    } else if (this.view.selectedTower) {
      this.view.selectedTower = null;
      this.ui.renderTowerPanel(null);
    }
  }
}
