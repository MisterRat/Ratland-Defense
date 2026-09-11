// First-time tutorial overlay: a 3-step instruction card shown once.
// Steps advance automatically as the player performs each action; the card
// is dismissable and the "seen" flag persists via localStorage (same
// try/catch fallback pattern as progress.js).

const TUTORIAL_KEY = 'towerDefenseTutorial.v1';

function tutorialDone() {
  try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch (err) { return false; }
}

function markTutorialDone() {
  try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (err) { /* no storage */ }
}

const TUTORIAL_STEPS = [
  { n: 1, text: 'Pick a tower from the shop on the right.' },
  { n: 2, text: 'Click a grass tile to build it. Right-click / Esc cancels.' },
  { n: 3, text: 'Press ▶ Resume to start — waves come automatically. Defend your base! (Send Next Wave early for bonus money.)' },
];

class Tutorial {
  constructor() {
    this.step = 0; // index into TUTORIAL_STEPS
    // Outer wrapper is pointer-events:none (CSS) so it never blocks the
    // canvas/shop; the inner card re-enables events for its buttons.
    this.el = document.createElement('div');
    this.el.id = 'tutorial';
    this.card = document.createElement('div');
    this.card.className = 'tut-card';
    this.el.appendChild(this.card);
    this.build();
    document.body.appendChild(this.el);
  }

  build() {
    this.card.innerHTML = '';
    const s = TUTORIAL_STEPS[this.step];
    const head = document.createElement('div');
    head.className = 'tut-head';
    head.textContent = `How to play — step ${s.n} of ${TUTORIAL_STEPS.length}`;
    this.card.appendChild(head);
    const body = document.createElement('div');
    body.className = 'tut-body';
    body.textContent = s.text;
    this.card.appendChild(body);
    const row = document.createElement('div');
    row.className = 'tut-row';
    if (this.step < TUTORIAL_STEPS.length - 1) {
      const next = document.createElement('button');
      next.className = 'tower-btn tut-next';
      next.textContent = 'Next →';
      next.addEventListener('click', () => this.advance());
      row.appendChild(next);
    }
    const skip = document.createElement('button');
    skip.className = 'tower-btn tut-skip';
    skip.textContent = '✕ Skip tutorial';
    skip.addEventListener('click', () => this.dismiss());
    row.appendChild(skip);
    this.card.appendChild(row);
  }

  // Advance one step; finishing the last step dismisses (and persists).
  advance() {
    if (this.step < TUTORIAL_STEPS.length - 1) {
      this.step++;
      this.build();
    } else {
      this.dismiss();
    }
  }

  dismiss() {
    markTutorialDone();
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
  }

  // Called each frame from main.js. Auto-advances when the player performs
  // the action the current step describes. No-op once dismissed.
  update(view, game) {
    if (!this.el) return;
    const s = this.step;
    if (s === 0 && view.placingType) this.advance();
    else if (s === 1 && game.towers.size > 0) this.advance();
    else if (s === 2 && waveCleared(game)) this.dismiss();
  }
}

// Step 3 completes when the first wave is fully cleared: placing the first
// tower starts wave 1 immediately, so "defend" means surviving it.
function waveCleared(game) {
  return game.waves.current >= 1 && !game.waves.inProgress && game.enemies.length === 0;
}
