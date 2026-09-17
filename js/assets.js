// Tower sprite loading. file:// safe: new Image() + relative paths, no fetch/XHR.
// TOWER_TYPES (config.js) must be loaded first.

const TowerAssets = {
  images: {}, // type -> HTMLImageElement
  loaded: {}, // type -> true once the image is confirmed usable

  init() {
    for (const type of Object.keys(TOWER_TYPES)) {
      const def = TOWER_TYPES[type];
      if (!def.img) continue;
      this.load(type, def.img);
    }
    // Terrain sprite: the 4×4-cell pond (200×200 px). Loaded separately from
    // the tower roster — terrain.js defines POND_SIZE, not TOWER_TYPES.
    if (typeof POND_SIZE !== 'undefined') this.load('pond', 'assets/pond.png');
  },

  load(type, src) {
    const img = new Image();
    img.onload = () => { this.loaded[type] = img.naturalWidth > 0; };
    img.onerror = () => { this.loaded[type] = false; };
    img.src = src;
    this.images[type] = img;
  },

  // Image element ready to draw, or null (caller falls back to procedural art).
  get(type) {
    return this.loaded[type] ? this.images[type] : null;
  },
};

// Auto-start in the browser; skipped in headless test sandboxes without Image.
if (typeof Image !== 'undefined') TowerAssets.init();
