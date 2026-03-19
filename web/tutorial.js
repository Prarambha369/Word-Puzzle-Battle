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
   * Show tutorial - NO INVERTED LOGIC CHECK
   * Simply displays the modal and starts from phase 1
   */
  show() {
    const modal = document.getElementById('tutorial-modal');
    if (!modal) {
      console.warn('[WPB] Tutorial modal not found');
      return;
    }
    
    modal.style.display = 'flex';
    this.renderPhase(1);
    console.log('[WPB] Tutorial showing Phase 1');
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
      nextBtn.textContent = 'START GAME 🚀';
      nextBtn.className = 'tutorial-btn tutorial-btn-primary tutorial-btn-start';
    } else {
      const btnTexts = ['', 'NEXT STEP', 'Next Step', 'Continue', 'START GAME'];
      nextBtn.textContent = btnTexts[phase] || 'NEXT STEP';
      nextBtn.className = 'tutorial-btn tutorial-btn-primary';
    }

    // Update skip button text
    const skipBtn = document.getElementById('tutorial-skip-btn');
    if (phase === 1) {
      skipBtn.textContent = 'Skip Tutorial';
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

    // Update text
    document.querySelector('.tutorial-title').innerHTML = '1. Plant a Letter';
    document.querySelector('.tutorial-description').innerHTML =
      'Tap an empty tile to place your first seed. The <span class="tutorial-accent">Trie dictionary</span> will validate your path.';
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 1 OF 4';
  }

  /**
   * Phase 2: Grow a Word
   */
  renderPhase2(container, modal) {
    const gridContainer = document.createElement('div');
    gridContainer.className = 'tutorial-mini-grid-container';

    const grid = document.createElement('div');
    grid.className = 'tutorial-mini-grid';
    grid.setAttribute('role', 'grid');
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';

    const layout = [
      ['S', 'A', 'L', 'T'],
      ['G', 'R', 'O', 'P'],
      ['B', 'E', 'W', 'N'],
      ['M', 'I', 'D', 'E']
    ];

    const highlighted = new Set(['G', 'R', 'O', 'W']);

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const tile = document.createElement('div');
        const letter = layout[row][col];
        tile.className = 'tutorial-mini-tile';
        if (highlighted.has(letter)) {
          tile.classList.add('tutorial-tile-highlighted-orange');
        }
        tile.textContent = letter;
        tile.setAttribute('role', 'gridcell');
        grid.appendChild(tile);
      }
    }

    gridContainer.appendChild(grid);

    // Add "GROW CONNECTED" message
    const message = document.createElement('div');
    message.className = 'tutorial-grow-message';
    message.innerHTML = '<span class="tutorial-leaf-icon">🍃</span> GROW CONNECTED!';
    gridContainer.appendChild(message);

    container.appendChild(gridContainer);

    // Update text
    document.querySelector('.tutorial-title').innerHTML = '2. Grow a Word';
    document.querySelector('.tutorial-description').innerHTML =
      'Connect letters in any direction — horizontally, vertically, or diagonally — to form words of 3+ letters.';
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 2 OF 4';
  }

  /**
   * Phase 3: Harvest Points
   */
  renderPhase3(container, modal) {
    const harvestContainer = document.createElement('div');
    harvestContainer.className = 'tutorial-harvest-container';

    // Scored word display
    const wordDisplay = document.createElement('div');
    wordDisplay.className = 'tutorial-scored-word';
    wordDisplay.innerHTML = `
      <div class="tutorial-word-tiles">
        <div class="tutorial-word-tile tutorial-tile-green">B</div>
        <div class="tutorial-word-tile tutorial-tile-green">A</div>
        <div class="tutorial-word-tile tutorial-tile-green">T</div>
        <div class="tutorial-word-tile tutorial-tile-green">T</div>
        <div class="tutorial-word-tile tutorial-tile-green">L</div>
        <div class="tutorial-word-tile tutorial-tile-green">E</div>
      </div>
    `;
    harvestContainer.appendChild(wordDisplay);

    // Points badge
    const pointsBadge = document.createElement('div');
    pointsBadge.className = 'tutorial-points-badge';
    pointsBadge.innerHTML = '<span class="tutorial-leaf-small">🍃</span> +3 pts';
    harvestContainer.appendChild(pointsBadge);

    // Success message
    const successMsg = document.createElement('div');
    successMsg.className = 'tutorial-success-msg';
    successMsg.innerHTML = '<span class="tutorial-checkmark">✓</span> Scored words flash green!';
    harvestContainer.appendChild(successMsg);

    container.appendChild(harvestContainer);

    // Update text
    document.querySelector('.tutorial-title').innerHTML = '3. Harvest Points';
    document.querySelector('.tutorial-description').innerHTML =
      '3-letter words earn <span style="color: var(--tutorial-accent)">1pt</span>. 4-letter words earn <span style="color: var(--tutorial-accent)">2pts</span>. Long words (5+) earn <span style="color: var(--tutorial-accent)">3pts</span>.';
    document.querySelector('.tutorial-progress-label').textContent = 'STEP 3 OF 4';
  }

  /**
   * Phase 4: Claim Victory
   */
  renderPhase4(container, modal) {
    const victoryCard = document.createElement('div');
    victoryCard.className = 'tutorial-victory-card';
    victoryCard.innerHTML = `
      <div class="tutorial-battle-hud">
        <div class="tutorial-battle-label">BATTLE HUD</div>
        <div class="tutorial-rocket-icon">🚀</div>
      </div>

      <div class="tutorial-victory-title">Victory Progress</div>
      <div class="tutorial-victory-subtitle">Almost there!</div>

      <div class="tutorial-progress-bar-large">
        <div class="tutorial-progress-fill-large" style="width: 95%;"></div>
      </div>

      <div class="tutorial-score-display">
        <span class="tutorial-score-number">19</span>
        <span class="tutorial-score-max">/ 20</span>
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
    if (closeBtn) closeBtn.style.display = 'flex';
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
    console.log('[WPB] Tutorial completed');
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
