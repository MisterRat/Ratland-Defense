// Phase 66: in-game Help — the ❓ Help button in the bottom bar opens the
// player guide (README.MD) in a scrollable modal over the game.
//
// The README is fetched at open time (served over http by the desktop exe's
// localhost server and by GitHub Pages) and rendered by the small Markdown
// subset renderer below — no libraries, the game stays dependency-free. Under
// file:// browsers block fetch, so the modal falls back to a link to the
// online README instead.
//
// Pausing is the caller's job (main.js onHelp): open(onClose) runs onClose
// when the modal is dismissed so the previous pause state can be restored.

const HELP_SRC = 'README.MD';
const HELP_ONLINE = 'https://github.com/MisterRat/Ratland-Defense#readme';

function helpEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// After escaping, let a fixed set of character entities (&nbsp; &middot; …
// and numeric ones) through again so the README can use them for spacing.
// Entities are inert text, so this is safe.
function helpEntities(s) {
  return s.replace(/&amp;(nbsp|middot|mdash|ndash|hellip|copy|bull|rarr|larr|amp|lt|gt|quot|#\d{1,6}|#x[0-9a-fA-F]{1,5});/g, '&$1;');
}

// Only http(s) URLs and plain relative paths are allowed into href/src —
// anything else (javascript:, data:, …) becomes '#'.
function helpSafeUrl(u) {
  u = u.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[A-Za-z0-9_.\/#-]+$/.test(u) && !/^\/\//.test(u)) return u;
  return '#';
}

// Inline Markdown: `code`, ![img](src), [link](url), <autolink>, **bold**,
// *italic*. Text is HTML-escaped first; code spans are protected from the
// other rules.
function helpInline(text) {
  return text.split(/(`[^`]*`)/).map(part => {
    if (/^`[^`]*`$/.test(part)) return '<code>' + helpEscape(part.slice(1, -1)) + '</code>';
    let s = helpEntities(helpEscape(part));
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
      (m, alt, src) => `<img alt="${alt}" src="${helpSafeUrl(src)}" loading="lazy">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      (m, t, u) => `<a href="${helpSafeUrl(u)}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g,
      (m, u) => `<a href="${helpSafeUrl(u)}" target="_blank" rel="noopener noreferrer">${u}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
    return s;
  }).join('');
}

function helpTableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

// Block Markdown: headings, paragraphs, - / 1. lists (with continuation
// lines), | tables |, ``` fences, --- rules, and <div align="center">
// blocks. Enough for the player guide.
function renderMarkdown(md) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // { tag, items: [] }
  const flushPara = () => { if (para.length) { out.push('<p>' + helpInline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => {
    if (!list) return;
    out.push(`<${list.tag}>` + list.items.map(it => '<li>' + helpInline(it) + '</li>').join('') + `</${list.tag}>`);
    list = null;
  };
  const flush = () => { flushPara(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) { // fenced code block
      flush();
      const code = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
      out.push('<pre><code>' + helpEscape(code.join('\n')) + '</code></pre>');
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    // The one raw-HTML block the README uses: <div align="center"> … </div>
    // (GitHub centers the title, links and hero image). Any other raw HTML
    // is NOT interpreted — it falls through and is shown escaped, as text.
    if (/^\s*<div\s+align\s*=\s*"?center"?\s*>\s*$/i.test(line)) { flush(); out.push('<div class="md-center">'); continue; }
    if (/^\s*<\/div>\s*$/i.test(line)) { flush(); out.push('</div>'); continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flush();
      const n = m[1].length;
      out.push(`<h${n}>${helpInline(m[2])}</h${n}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      flush();
      const head = helpTableCells(line);
      const rows = [];
      for (i += 2; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(helpTableCells(lines[i]));
      i--;
      let html = '<table>';
      if (head.some(c => c)) html += '<thead><tr>' + head.map(c => '<th>' + helpInline(c) + '</th>').join('') + '</tr></thead>';
      html += '<tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + helpInline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      out.push(html);
      continue;
    }
    if ((m = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(line))) {
      flushPara();
      const tag = /\d/.test(m[1]) ? 'ol' : 'ul';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(m[2]);
      continue;
    }
    if (list && /^\s+\S/.test(line)) { // continuation of the current list item
      list.items[list.items.length - 1] += ' ' + line.trim();
      continue;
    }
    flushList();
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

const Help = {
  isOpen: false,
  _overlay: null,
  _body: null,
  _html: null,     // rendered README, cached after the first successful load
  _onClose: null,
  _keyBound: false,

  // Build the overlay once: backdrop + card (header with ✕, scrolling body).
  _build() {
    const ov = document.createElement('div');
    ov.id = 'helpOverlay';
    ov.innerHTML =
      '<div class="help-card" role="dialog" aria-modal="true" aria-label="Help">' +
        '<div class="help-head"><span class="help-title">❓ Help — Player Guide</span>' +
        '<button class="tower-btn help-close" title="Close (Esc)">✕ Close</button></div>' +
        '<div class="help-body" tabindex="-1"></div>' +
      '</div>';
    ov.addEventListener('mousedown', e => { if (e.target === ov) this.close(); });
    ov.querySelector('.help-close').addEventListener('click', () => this.close());
    // Appended to <html>, NOT <body>: js/fit.js scales <body> down with a CSS
    // transform in small windows, which would shrink the guide's text too and
    // make the fixed overlay cover only the scaled body box. Outside <body>
    // the overlay is always viewport-sized and full-size (and fit.js, which
    // measures body.children, never sees it).
    document.documentElement.appendChild(ov);
    this._overlay = ov;
    this._body = ov.querySelector('.help-body');
  },

  // Capture-phase key handler: while open, Esc closes and no key reaches the
  // game's own handlers (Space must not toggle pause behind the modal).
  _bindKeys() {
    if (this._keyBound) return;
    this._keyBound = true;
    window.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      e.stopPropagation();
    }, true);
  },

  _load() {
    if (this._html) { this._body.innerHTML = this._html; return; }
    this._body.innerHTML = '<p class="help-note">Loading…</p>';
    fetch(HELP_SRC, { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(md => { this._html = renderMarkdown(md); this._body.innerHTML = this._html; })
      .catch(() => {
        this._body.innerHTML =
          '<p class="help-note">The guide can\'t be loaded when the game is opened straight from a file. ' +
          `Read it online instead: <a href="${HELP_ONLINE}" target="_blank" rel="noopener noreferrer">Ratland Defense Player Guide</a>.</p>`;
      });
  },

  open(onClose) {
    if (this.isOpen) return;
    if (!this._overlay) this._build();
    this._bindKeys();
    this._onClose = onClose || null;
    this.isOpen = true;
    this._overlay.classList.add('open');
    this._load();
    this._body.scrollTop = 0;
    // Focus the scrolling body, not the ✕ button: Space/arrows/PgDn then
    // scroll the guide (a focused button would treat Space as a click).
    this._body.focus({ preventScroll: true });
  },

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._overlay.classList.remove('open');
    const cb = this._onClose;
    this._onClose = null;
    if (cb) cb();
  },
};
