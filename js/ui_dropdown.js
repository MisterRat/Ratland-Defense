// Phase 64: custom dropdown that opens UPWARD over the play area.
// Native <select> popups can't be forced upward, and the tower-detail row now
// sits BELOW the canvas — a downward popup would cover the bottom bar instead
// of the playfield. This component replaces the panel's native selects.
//
// API: new Dropdown(parent, label, options, currentValue, onChange)
//   options: [{ value, text, disabled? }]
//   onChange(value) fires on option click (or .selectOption()).
// Test-friendly surface (smoke stubs have no real event dispatch):
//   dd.value        current value
//   dd.options      array of option values
//   dd.selectOption(v)  set + fire onChange + close
// Headless-safe: no closest()/blur()/layout APIs; document listeners are only
// attached while a dropdown is open and removed on close, so rebuilding the
// panel (tower dies mid-wave) can't leak listeners.

class Dropdown {
  static _open = null; // at most one open list at a time

  constructor(parent, label, options, currentValue, onChange) {
    this.parent = parent;
    this.label = label || '';
    this._opts = options || [];
    this.onChange = onChange || (() => {});
    this._value = (currentValue != null) ? String(currentValue) : '';

    const wrap = document.createElement('div');
    wrap.className = 'dd';
    this.root = wrap;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tower-btn dd-btn';
    btn.textContent = `${this.label} ${this._textOf(this._value)} ▾`;
    btn.addEventListener('click', () => this.toggle());
    this.btn = btn;

    const list = document.createElement('div');
    list.className = 'dd-list';
    for (const opt of this._opts) {
      const o = document.createElement('button');
      o.type = 'button';
      o.className = 'dd-opt' + (opt.value === this._value ? ' sel' : '');
      if (opt.disabled) o.disabled = true;
      o.textContent = opt.text;
      o.addEventListener('click', () => this.selectOption(opt.value));
      list.appendChild(o);
    }
    this.list = list;

    wrap.appendChild(btn);
    wrap.appendChild(list);
    parent.appendChild(wrap);
  }

  _textOf(value) {
    const opt = this._opts.find(o => o.value === value);
    return opt ? opt.text : (value === '' ? 'Any' : String(value));
  }

  get value() { return this._value; }
  get options() { return this._opts.map(o => o.value); }

  toggle() {
    if (this.isOpen()) { this.close(); return; }
    Dropdown.closeAll(this);
    this.root.classList.add('open');
    Dropdown._open = this;
    this._attachOutsideClose();
    // Drop focus so a follow-up Space press doesn't re-fire the button.
    if (typeof this.btn.blur === 'function') this.btn.blur();
  }

  isOpen() { return Dropdown._open === this; }

  close() {
    this.root.classList.remove('open');
    if (Dropdown._open === this) Dropdown._open = null;
    this._detachOutsideClose();
  }

  static closeAll(except) {
    const open = Dropdown._open;
    if (open && open !== except) open.close();
  }

  selectOption(value) {
    this._value = String(value);
    this.btn.textContent = `${this.label} ${this._textOf(this._value)} ▾`;
    for (let i = 0; i < this.list.children.length; i++) {
      const opt = this._opts[i];
      this.list.children[i].classList.toggle('sel', !!opt && opt.value === this._value);
    }
    this.close();
    this.onChange(this._value);
  }

  _onOutsideDown = (e) => {
    if (this.root.contains && this.root.contains(e.target)) return;
    this.close();
  };

  _onEscape = (e) => {
    if (e.key === 'Escape') this.close();
  };

  _attachOutsideClose() {
    const d = typeof document !== 'undefined' ? document : null;
    if (!d || typeof d.addEventListener !== 'function') return;
    d.addEventListener('mousedown', this._onOutsideDown);
    d.addEventListener('keydown', this._onEscape);
  }

  _detachOutsideClose() {
    const d = typeof document !== 'undefined' ? document : null;
    if (!d || typeof d.removeEventListener !== 'function') return;
    d.removeEventListener('mousedown', this._onOutsideDown);
    d.removeEventListener('keydown', this._onEscape);
  }
}
