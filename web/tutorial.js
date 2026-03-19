/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 *
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */

class Tutorial {
  constructor() {
    this.currentPhase = 1;
    this.totalPhases  = 4;
    this.completed    = false;
    this.storageKey   = 'wpb-tutorial-completed';
    this._init();
  }

  /** Initialize tutorial system — safe to call before DOMContentLoaded fires. */
  _init() {
    this.hasCompletedTutorial = localStorage.getItem(this.storageKey) === 'true';
    this._createModalHTML();
    this._attachEventListeners();
  }

  /** @returns {boolean} */
  shouldShowTutorial() {
    return !this.hasCompletedTutorial;
  }

  /** Build the modal skeleton and append to <body>. */
  _createModalHTML() {
    // Guard against duplicate modals
    if (document.getElementById('tutorial-modal')) return;

    const modal = document.createElement('div');
    modal.id        = 'tutorial-modal';
    modal.className = 'tutorial-modal tutorial-phase-1';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Tutorial: Plant a Letter');

    modal.innerHTML = `
      <div class="tutorial-content">
        <button class="tutorial-close" aria-label="Close tutorial" style="display:none">
          <span aria-hidden="true">×</span>
        </button>

        <div class="tutorial-progress-section">
          <div class="tutorial-progress-label">STEP <span class="tutorial-step">1</span> OF 4</div>
          <div class="tutorial-progress-bar">
            <div class="tutorial-progress-fill" style="width:25%"></div>
          </div>
        </div>

        <h2 class="tutorial-title">1. Plant a Letter</h2>

        <p class="tutorial-description">
          Tap an empty tile to place your first seed. The
          <span class="tutorial-accent">Trie dictionary</span> will validate your path.
        </p>

        <div class="tutorial-visual-container" id="tutorial-visual"></div>

        <div class="tutorial-buttons">
          <button class="tutorial-btn tutorial-btn-primary" id="tutorial-next-btn">NEXT STEP</button>
          <button class="tutorial-btn tutorial-btn-skip"    id="tutorial-skip-btn">Skip Tutorial</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /** Attach button event listeners. */
  _attachEventListeners() {
    // Use event delegation on the modal to avoid stale references
    document.body.addEventListener('click', e => {
      const modal = document.getElementById('tutorial-modal');
      if (!modal || modal.style.display === 'none') return;

      if (e.target.closest('#tutorial-next-btn')) this.nextPhase();
      if (e.target.closest('#tutorial-skip-btn')) this.skipTutorial();
      if (e.target.closest('.tutorial-close'))    this.skipTutorial();
    });
  }

  /** Display the tutorial modal starting at phase 1. */
  show() {
    const modal = document.getElementById('tutorial-modal');
    if (!modal) { console.warn('[WPB] Tutorial modal not found'); return; }
    modal.style.display = 'flex';
    this.renderPhase(1);
    console.log('[WPB] Tutorial showing Phase 1');
  }

  /**
   * Render a specific phase.
   * @param {number} phase
   */
  renderPhase(phase) {
    this.currentPhase = phase;
    const modal           = document.getElementById('tutorial-modal');
    const visualContainer = document.getElementById('tutorial-visual');
    const progressFill    = modal.querySelector('.tutorial-progress-fill');
    const stepSpan        = modal.querySelector('.tutorial-step');

    // Update progress bar
    progressFill.style.width = `${(phase / this.totalPhases) * 100}%`;
    stepSpan.textContent = phase;

    // Clear visual area
    visualContainer.innerHTML = '';

    // Render phase content
    switch (phase) {
      case 1: this._renderPhase1(visualContainer); break;
      case 2: this._renderPhase2(visualContainer); break;
      case 3: this._renderPhase3(visualContainer); break;
      case 4: this._renderPhase4(visualContainer); break;
    }

    // Swap modal theme class
    modal.className = `tutorial-modal tutorial-phase-${phase}`;

    // Update main CTA button
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (phase === this.totalPhases) {
      nextBtn.textContent = 'START GAME 🚀';
      nextBtn.className   = 'tutorial-btn tutorial-btn-primary tutorial-btn-start';
    } else {
      const labels = ['', 'NEXT STEP', 'NEXT STEP', 'CONTINUE', 'START GAME 🚀'];
      nextBtn.textContent = labels[phase];
      nextBtn.className   = 'tutorial-btn tutorial-btn-primary';
    }

    // Skip button only on phase 1
    const skipBtn = document.getElementById('tutorial-skip-btn');
    if (skipBtn) skipBtn.style.display = phase === 1 ? 'block' : 'none';

    // Close button only on phase 4
    const closeBtn = modal.querySelector('.tutorial-close');
    if (closeBtn) closeBtn.style.display = phase === this.totalPhases ? 'flex' : 'none';

    // Update ARIA label
    const phaseNames = ['Plant a Letter', 'Grow a Word', 'Harvest Points', 'Claim Victory'];
    modal.setAttribute('aria-label', `Tutorial Phase ${phase}: ${phaseNames[phase - 1]}`);
  }

  /* ── Phase renderers ─────────────────────────────────────────── */

  /**
   * Phase 1: full 10×10 grid with a highlighted center tile.
   * @param {HTMLElement} container
   */
  _renderPhase1(container) {
    const grid = document.createElement('div');
    grid.className = 'tutorial-grid';
    grid.setAttribute('role', 'grid');

    const frag = document.createDocumentFragment();
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const tile = document.createElement('div');
        tile.className = 'tutorial-tile';
        tile.setAttribute('role', 'gridcell');
        tile.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}`);
        if (r === 5 && c === 5) {
          tile.classList.add('tutorial-tile-highlight');
          tile.innerHTML = '<span class="tutorial-cursor-icon" aria-hidden="true">👆</span>';
        }
        frag.appendChild(tile);
      }
    }
    grid.appendChild(frag);
    container.appendChild(grid);

    // Update text content
    document.querySelector('.tutorial-title').textContent       = '1. Plant a Letter';
    document.querySelector('.tutorial-description').innerHTML   =
      'Tap an empty tile to place your first seed. The <span class="tutorial-accent">Trie dictionary</span> will validate your path.';
    document.querySelector('.tutorial-progress-label').innerHTML =
      'STEP <span class="tutorial-step">1</span> OF 4';
  }

  /**
   * Phase 2: 4×4 mini-grid demonstrating the word GROW highlighted by position.
   * FIX: uses row/col position keys — not letter content — to avoid highlighting
   * the wrong cells when duplicate letters exist in the grid.
   * @param {HTMLElement} container
   */
  _renderPhase2(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tutorial-mini-grid-container';

    const grid = document.createElement('div');
    grid.className = 'tutorial-mini-grid';
    grid.setAttribute('role', 'grid');

    // Layout: GROW is at row 1, cols 0-3 (a clean horizontal word)
    const layout = [
      ['S', 'A', 'L', 'T'],
      ['G', 'R', 'O', 'W'],   // ← GROW highlighted
      ['B', 'E', 'D', 'N'],
      ['M', 'I', 'C', 'E']
    ];

    // Use position-based keys (not letter content) to avoid false matches
    const highlightedPositions = new Set(['1-0', '1-1', '1-2', '1-3']);

    const frag = document.createDocumentFragment();
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const tile   = document.createElement('div');
        const letter = layout[r][c];
        tile.className   = 'tutorial-mini-tile';
        tile.textContent = letter;
        tile.setAttribute('role', 'gridcell');
        tile.setAttribute('aria-label', letter);
        if (highlightedPositions.has(`${r}-${c}`)) {
          tile.classList.add('tutorial-tile-highlighted-orange');
        }
        frag.appendChild(tile);
      }
    }
    grid.appendChild(frag);
    wrapper.appendChild(grid);

    const message = document.createElement('div');
    message.className = 'tutorial-grow-message';
    message.innerHTML = '<span class="tutorial-leaf-icon" aria-hidden="true">🍃</span> GROW CONNECTED!';
    wrapper.appendChild(message);

    container.appendChild(wrapper);

    document.querySelector('.tutorial-title').textContent      = '2. Grow a Word';
    document.querySelector('.tutorial-description').textContent =
      'Connect letters in any direction — horizontally, vertically, or diagonally — to form words of 3+ letters.';
    document.querySelector('.tutorial-progress-label').innerHTML =
      'STEP <span class="tutorial-step">2</span> OF 4';
  }

  /**
   * Phase 3: word tiles + scoring breakdown.
   * @param {HTMLElement} container
   */
  _renderPhase3(container) {
    const harvest = document.createElement('div');
    harvest.className = 'tutorial-harvest-container';

    // Scored word display
    const wordDisplay = document.createElement('div');
    wordDisplay.className = 'tutorial-scored-word';

    const wordTiles = document.createElement('div');
    wordTiles.className = 'tutorial-word-tiles';

    for (const letter of 'BATTLE') {
      const t = document.createElement('div');
      t.className   = 'tutorial-word-tile tutorial-tile-green';
      t.textContent = letter;
      t.setAttribute('aria-hidden', 'true');
      wordTiles.appendChild(t);
    }
    wordDisplay.appendChild(wordTiles);
    harvest.appendChild(wordDisplay);

    // Points badge
    const badge = document.createElement('div');
    badge.className = 'tutorial-points-badge';
    badge.innerHTML = '<span class="tutorial-leaf-small" aria-hidden="true">🍃</span> +3 pts';
    harvest.appendChild(badge);

    // Success message
    const successMsg = document.createElement('div');
    successMsg.className = 'tutorial-success-msg';
    successMsg.innerHTML = '<span class="tutorial-checkmark" aria-hidden="true">✓</span> Scored words flash green!';
    harvest.appendChild(successMsg);

    container.appendChild(harvest);

    document.querySelector('.tutorial-title').textContent      = '3. Harvest Points';
    document.querySelector('.tutorial-description').innerHTML  =
      '3-letter words earn <span style="color:var(--tutorial-accent)">1pt</span>. ' +
      '4-letter earn <span style="color:var(--tutorial-accent)">2pts</span>. ' +
      'Words of 5+ earn <span style="color:var(--tutorial-accent)">3pts</span>.';
    document.querySelector('.tutorial-progress-label').innerHTML =
      'STEP <span class="tutorial-step">3</span> OF 4';
  }

  /**
   * Phase 4: victory progress card.
   * @param {HTMLElement} container
   */
  _renderPhase4(container) {
    const card = document.createElement('div');
    card.className = 'tutorial-victory-card';
    card.innerHTML = `
      <div class="tutorial-battle-hud">
        <span class="tutorial-battle-label">BATTLE HUD</span>
        <span class="tutorial-rocket-icon" aria-hidden="true">🚀</span>
      </div>
      <div class="tutorial-victory-title">Victory Progress</div>
      <div class="tutorial-victory-subtitle">Almost there!</div>
      <div class="tutorial-progress-bar-large" role="progressbar" aria-valuenow="95" aria-valuemin="0" aria-valuemax="100">
        <div class="tutorial-progress-fill-large" style="width:95%"></div>
      </div>
      <div class="tutorial-score-display">
        <span class="tutorial-score-number">19</span>
        <span class="tutorial-score-max">/ 20</span>
      </div>
      <div class="tutorial-victory-footer">
        <span class="tutorial-victory-bullet" aria-hidden="true">●</span>
        <span>Finalizing results…</span>
        <div class="tutorial-player-pill">
          <span class="tutorial-player-avatar" aria-hidden="true">👤</span>
          <span>You</span>
        </div>
      </div>
    `;
    container.appendChild(card);

    document.querySelector('.tutorial-title').textContent      = '4. Claim Victory';
    document.querySelector('.tutorial-description').textContent =
      'Be the first to reach 20 points. Anti-double-scoring ensures every unique word path counts exactly once.';
    document.querySelector('.tutorial-progress-label').innerHTML =
      'STEP <span class="tutorial-step">4</span> OF 4';
  }

  /* ── Navigation ──────────────────────────────────────────────── */

  /** Advance to the next phase or complete if on last phase. */
  nextPhase() {
    if (this.currentPhase < this.totalPhases) {
      this.renderPhase(this.currentPhase + 1);
    } else {
      this.completeTutorial();
    }
  }

  /** Skip the tutorial entirely. */
  skipTutorial() {
    this.completeTutorial();
  }

  /** Persist completion, hide modal, dispatch event. */
  completeTutorial() {
    localStorage.setItem(this.storageKey, 'true');
    this.hasCompletedTutorial = true;
    this.completed            = true;

    const modal = document.getElementById('tutorial-modal');
    if (modal) modal.style.display = 'none';

    window.dispatchEvent(new CustomEvent('tutorial-completed'));
    console.log('[WPB] Tutorial completed');
  }

  /**
   * Reset tutorial state — used by the "How to Play" button.
   * Clears localStorage so shouldShowTutorial() returns true again.
   */
  reset() {
    localStorage.removeItem(this.storageKey);
    this.hasCompletedTutorial = false;
    this.completed            = false;
    this.currentPhase         = 1;
  }
}

/* ==========================================================
   BOOT
   Tutorial.js is loaded at the bottom of <body> so the DOM
   is ready. We initialize directly — no DOMContentLoaded needed.
   ========================================================== */
window.tutorial = new Tutorial();

// If the trie is already done (game.js fired early), check now.
// Otherwise game.js's setTimeout(50) in the buildTrieAsync callback catches it.
if (window.tutorial.shouldShowTutorial() &&
    document.getElementById('menu-body') &&
    !document.getElementById('menu-body').classList.contains('hidden')) {
  window.tutorial.show();
}
