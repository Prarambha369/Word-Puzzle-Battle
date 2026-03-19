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
    this.totalPhases = 4;
    this.skipped = false;
    this.completed = false;
    this.storageKey = 'wpb-tutorial-completed';
    this.init();
  }

  /**
   * Initialize tutorial system
   */
  init() {
    this.hasCompletedTutorial = localStorage.getItem(this.storageKey) === 'true';
    this.createModalHTML();
    this.attachEventListeners();
  }

  /**
   * Check if user should see tutorial
   */
  shouldShowTutorial() {
    return !this.hasCompletedTutorial;
  }

  /**
   * Create modal HTML structure
   */
  createModalHTML() {
    const tutorial = document.createElement('div');
    tutorial.id = 'tutorial-modal';
    tutorial.className = 'tutorial-modal tutorial-phase-1';
    tutorial.role = 'dialog';
    tutorial.setAttribute('aria-label', 'Tutorial: Plant a Letter');

    tutorial.innerHTML = `
      <div class="tutorial-content">
        <!-- Close button (Phase 1 only) -->
        <button class="tutorial-close" aria-label="Close tutorial" style="display: none;">
          <span>×</span>
        </button>

        <!-- Progress section -->
        <div class="tutorial-progress-section">
          <div class="tutorial-progress-label">STEP <span class="tutorial-step">1</span> OF 4</div>
          <div class="tutorial-progress-bar">
            <div class="tutorial-progress-fill" style="width: 25%;"></div>
          </div>
        </div>

        <!-- Title -->
        <h2 class="tutorial-title">1. Plant a Letter</h2>

        <!-- Description -->
        <p class="tutorial-description">
          Tap an empty tile to place your first seed. The <span class="tutorial-accent">Trie dictionary</span> will validate your path.
        </p>

        <!-- Visual element container -->
        <div class="tutorial-visual-container" id="tutorial-visual">
          <!-- Phase 1: 10x10 Grid -->
          <div class="tutorial-phase-1-grid"></div>
        </div>

        <!-- Buttons -->
        <div class="tutorial-buttons">
          <button class="tutorial-btn tutorial-btn-primary" id="tutorial-next-btn">
            NEXT STEP
          </button>
          <button class="tutorial-btn tutorial-btn-skip" id="tutorial-skip-btn">
            Skip Tutorial
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(tutorial);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const nextBtn = document.getElementById('tutorial-next-btn');
    const skipBtn = document.getElementById('tutorial-skip-btn');
    const closeBtn = document.querySelector('.tutorial-close');

    nextBtn.addEventListener('click', () => this.nextPhase());
    skipBtn.addEventListener('click', () => this.skipTutorial());
    if (closeBtn) closeBtn.addEventListener('click', () => this.skipTutorial());
  }

  /**
   * Show tutorial
   */
  show() {
    if (!this.shouldShowTutorial()) return;
    
    const modal = document.getElementById('tutorial-modal');
    modal.style.display = 'flex';
    this.renderPhase(1);
  }

  /**
   * Render specific phase content
   */
  renderPhase(phase) {
    this.currentPhase = phase;
    const modal = document.getElementById('tutorial-modal');
    const visualContainer = document.getElementById('tutorial-visual');
    const progressFill = document.querySelector('.tutorial-progress-fill');
    const stepSpan = document.querySelector('.tutorial-step');

    // Update progress
    const progressPercent = (phase / this.totalPhases) * 100;
    progressFill.style.width = progressPercent + '%';
    stepSpan.textContent = phase;

    // Clear and render visual
    visualContainer.innerHTML = '';

    switch (phase) {
      case 1:
        this.renderPhase1(visualContainer, modal);
        break;
      case 2:
        this.renderPhase2(visualContainer, modal);
        break;
      case 3:
        this.renderPhase3(visualContainer, modal);
        break;
      case 4:
        this.renderPhase4(visualContainer, modal);
        break;
    }

    // Update modal class for theme
    modal.className = `tutorial-modal tutorial-phase-${phase}`;

    // Update button text
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (phase === 4) {
      nextBtn.textContent = 'START GAME';
      nextBtn.className = 'tutorial-btn tutorial-btn-primary tutorial-btn-start';
    } else {
      const btnTexts = ['', 'NEXT STEP', 'Next Step', 'Continue', 'START GAME'];
      nextBtn.textContent = btnTexts[phase] || 'NEXT STEP';
      nextBtn.className = 'tutorial-btn tutorial-btn-primary';
    }

    // Update skip button text
    const skipBtn = document.getElementById('tutorial-skip-btn');
    if (phase === 1) {
      skipBtn.textContent = 'I Know the Rules';
      skipBtn.style.display = 'block';
    } else {
      skipBtn.style.display = 'none';
    }

    // Update aria-label
    const titles = ['Plant a Letter', 'Grow a Word', 'Harvest Points', 'Claim Victory'];
    modal.setAttribute('aria-label', `Tutorial Phase ${phase}: ${titles[phase - 1]}`);
  }

  /**
   * Phase 1: Plant a Letter
   */
  renderPhase1(container, modal) {
    const grid = document.createElement('div');
    grid.className = 'tutorial-grid';
    grid.setAttribute('role', 'grid');

    // Create 10x10 grid
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const tile = document.createElement('div');
        tile.className = 'tutorial-tile';
        tile.setAttribute('role', 'gridcell');
        tile.setAttribute('aria-label', `Row ${row + 1}, Column ${col + 1}`);

        // Highlight center tile
        if (row === 5 && col === 5) {
          tile.classList.add('tutorial-tile-highlight');
          tile.innerHTML = '<span class="tutorial-cursor-icon">👆</span>';
        }

        grid.appendChild(tile);
      }
    }

    container.appendChild(grid);

    // Update title and description
    document.querySelector('.tutorial-title').innerHTML = '1. Plant a Letter';
    document.querySelector('.tutorial-description').innerHTML =
      'Tap an empty tile to place your first seed. The <span class="tutorial-accent">Trie dictionary</span> will validate your path.';

    // Update progress label
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 1 OF 4';

    // Hide close button for Phase 1
    const closeBtn = document.querySelector('.tutorial-close');
    closeBtn.style.display = 'none';
  }

  /**
   * Phase 2: Grow a Word
   */
  renderPhase2(container, modal) {
    const grid = document.createElement('div');
    grid.className = 'tutorial-grid tutorial-grid-sm';

    // Create 4x4 grid with example word
    const exampleWord = { word: 'GRO', row: 0, col: 0 };
    const tiles = [
      { row: 0, col: 0, letter: 'S', empty: false, unplayed: true },
      { row: 0, col: 1, letter: 'A', empty: false, unplayed: true },
      { row: 0, col: 2, letter: 'L', empty: false, unplayed: true },
      { row: 0, col: 3, letter: 'T', empty: false, unplayed: true },
      { row: 1, col: 0, letter: 'G', empty: false, highlighted: true },
      { row: 1, col: 1, letter: 'R', empty: false, highlighted: true },
      { row: 1, col: 2, letter: 'O', empty: false, highlighted: true },
      { row: 1, col: 3, letter: 'P', empty: false, unplayed: true },
      { row: 2, col: 0, letter: 'B', empty: false, unplayed: true },
      { row: 2, col: 1, letter: 'E', empty: false, unplayed: true },
      { row: 2, col: 2, letter: 'W', empty: false, unplayed: true },
      { row: 2, col: 3, letter: 'N', empty: false, unplayed: true },
      { row: 3, col: 0, letter: 'M', empty: false, unplayed: true },
      { row: 3, col: 1, letter: 'I', empty: false, unplayed: true },
      { row: 3, col: 2, letter: 'D', empty: false, unplayed: true },
      { row: 3, col: 3, letter: 'E', empty: false, unplayed: true },
    ];

    tiles.forEach(tileData => {
      const tile = document.createElement('div');
      tile.className = 'tutorial-tile tutorial-tile-md';
      if (tileData.highlighted) {
        tile.className += ' tutorial-tile-highlighted';
      } else if (tileData.unplayed) {
        tile.className += ' tutorial-tile-unplayed';
      }
      tile.textContent = tileData.letter;
      grid.appendChild(tile);
    });

    // Wrap in container for styling
    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'tutorial-grid-wrapper';
    gridWrapper.appendChild(grid);

    // Add success badge
    const badge = document.createElement('div');
    badge.className = 'tutorial-badge tutorial-badge-success';
    badge.innerHTML = '🌱 GROW CONNECTED!';
    gridWrapper.appendChild(badge);

    container.appendChild(gridWrapper);

    // Update text
    document.querySelector('.tutorial-title').innerHTML = '2. Grow a Word';
    document.querySelector('.tutorial-description').innerHTML =
      'Connect letters in any direction—horizontally, vertically, or diagonally—to form words of 3+ letters.';
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 2 OF 4';
  }

  /**
   * Phase 3: Harvest Points
   */
  renderPhase3(container, modal) {
    // Word display
    const wordDisplay = document.createElement('div');
    wordDisplay.className = 'tutorial-word-display';

    const word = 'BATTLE';
    word.split('').forEach(letter => {
      const tile = document.createElement('div');
      tile.className = 'tutorial-word-tile';
      tile.textContent = letter;
      wordDisplay.appendChild(tile);
    });

    // Floating badge
    const pointsBadge = document.createElement('div');
    pointsBadge.className = 'tutorial-points-badge';
    pointsBadge.textContent = '+3 pts';

    wordDisplay.appendChild(pointsBadge);

    container.appendChild(wordDisplay);

    // Scoring info
    const scoringInfo = document.createElement('div');
    scoringInfo.className = 'tutorial-scoring-info';
    scoringInfo.innerHTML = `
      <div class="tutorial-scoring-row">
        <span>3-letter words earn <strong class="tutorial-accent">1pt</strong>.</span>
      </div>
      <div class="tutorial-scoring-row">
        <span>4-letter words earn <strong class="tutorial-accent">2pts</strong>.</span>
      </div>
      <div class="tutorial-scoring-row">
        <span>Long words (5+) earn <strong class="tutorial-accent">3pts</strong>.</span>
      </div>
    `;
    container.appendChild(scoringInfo);

    // Success callout
    const callout = document.createElement('div');
    callout.className = 'tutorial-callout tutorial-callout-success';
    callout.innerHTML = '<span class="tutorial-checkmark">✓</span> Scored words flash green!';
    container.appendChild(callout);

    // Update text
    document.querySelector('.tutorial-title').innerHTML = '3. Harvest Points';
    document.querySelector('.tutorial-description').innerHTML =
      'Score points when you complete valid words. Each word length earns different points.';
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 3 OF 4';
  }

  /**
   * Phase 4: Claim Victory
   */
  renderPhase4(container, modal) {
    const victoryCard = document.createElement('div');
    victoryCard.className = 'tutorial-victory-card';

    victoryCard.innerHTML = `
      <div class="tutorial-victory-header">
        <div class="tutorial-victory-label">BATTLE HUD</div>
        <div class="tutorial-victory-badge">🏆</div>
      </div>

      <div class="tutorial-victory-content">
        <div class="tutorial-victory-title">Victory Progress</div>
        <div class="tutorial-victory-status">Almost there!</div>
        <div class="tutorial-victory-score">19 / 20</div>
      </div>

      <div class="tutorial-progress-bar tutorial-progress-bar-card">
        <div class="tutorial-progress-fill" style="width: 95%;"></div>
      </div>

      <div class="tutorial-victory-footer">
        <span class="tutorial-victory-bullet">●</span>
        <span>Finalizing results...</span>
        <div class="tutorial-player-pill">
          <span class="tutorial-player-avatar">👤</span>
          <span>You</span>
        </div>
      </div>
    `;

    container.appendChild(victoryCard);

    // Update text
    document.querySelector('.tutorial-title').innerHTML = '4. Claim Victory';
    document.querySelector('.tutorial-description').innerHTML =
      'Be the first to reach 20 points to claim the forest. Anti-double-scoring ensures every unique word counts.';
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 4 OF 4';

    // Show close button for Phase 4
    const closeBtn = document.querySelector('.tutorial-close');
    closeBtn.style.display = 'flex';
  }

  /**
   * Move to next phase
   */
  nextPhase() {
    if (this.currentPhase < this.totalPhases) {
      this.renderPhase(this.currentPhase + 1);
    } else if (this.currentPhase === this.totalPhases) {
      this.completeTutorial();
    }
  }

  /**
   * Skip tutorial
   */
  skipTutorial() {
    this.completeTutorial();
  }

  /**
   * Complete tutorial
   */
  completeTutorial() {
    localStorage.setItem(this.storageKey, 'true');
    this.hasCompletedTutorial = true;
    this.completed = true;

    const modal = document.getElementById('tutorial-modal');
    if (modal) {
      modal.style.display = 'none';
    }

    // Dispatch custom event so game can start
    window.dispatchEvent(new CustomEvent('tutorial-completed'));
  }

  /**
   * Reset tutorial for testing
   */
  reset() {
    localStorage.removeItem(this.storageKey);
    this.hasCompletedTutorial = false;
    this.completed = false;
    this.currentPhase = 1;
  }
}

// Initialize tutorial on page load
document.addEventListener('DOMContentLoaded', () => {
  window.tutorial = new Tutorial();
});
