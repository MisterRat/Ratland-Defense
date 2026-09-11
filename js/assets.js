// Tower sprite loading. file:// safe: new Image() + relative paths, no fetch/XHR.
// TOWER_TYPES (config.js) must be loaded first.

const TowerAssets = {
  images: {}, // type -> HTMLImageElement
  loaded: {}, // type -> true once the image is confirmed usable

  init() {
    for (const type of Object.keys(TOWER_TYPES)) {
      const def = TOWER_TYPES[type];
      if (!def.img) continue;
      const img = new Image();
      img.onload = () => { this.loaded[type] = img.naturalWidth > 0; };
      img.onerror = () => { this.loaded[type] = false; };
      img.src = def.img;
      this.images[type] = img;
    }
  },

  // Image element ready to draw, or null (caller falls back to procedural art).
  get(type) {
    return this.loaded[type] ? this.images[type] : null;
  },
};

// Auto-start in the browser; skipped in headless test sandboxes without Image.
if (typeof Image !== 'undefined') TowerAssets.init();
