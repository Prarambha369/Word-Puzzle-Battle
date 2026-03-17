/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * https://github.com/Prarambha369/Word-Puzzle-Battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */

'use strict';

/** @type {Array<Array<Object>>} */
let board = [];

/** @type {string} - Current turn ('p1' or 'p2') */
let currentTurn = 'p1';

/** @type {Object<string, number>} - Player scores */
let scores = { p1: 0, p2: 0 };

/** @type {Object|null} - Loaded Trie dictionary */
let trie = null;

/** @type {boolean} - Whether game is over */
let gameOver = false;

/** @type {Object|null} - Cell being filled by modal */
let pendingCell = null;

/** @type {Set<string>} - Scored path keys (prevents double scoring) */
let scoredPaths = new Set();

/** @type {Array<string>} - Words formed in this match */
let lastWords = [];

/** @type {string} - Game mode ('vs-ai' or 'vs-human') */
let gameMode = 'vs-human';

/** @type {string} - AI difficulty ('easy', 'medium', 'hard') */
let aiDifficulty = 'medium';

/** Constants */
const WIN_SCORE = 20;
const BOARD_SIZE = 10;

/**
 * Initializes the 10x10 game board array and resets all state.
 * Called at start of each new game.
 * @returns {void}
 */
function initBoard() {
  // Reset board array  board = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    board[r] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      board[r][c] = {
        letter: null,
        owner: null,
        row: r,
        col: c,
        highlighted: false
      };
    }
  }

  // Reset scores and state
  scores = { p1: 0, p2: 0 };
  currentTurn = 'p1';
  gameOver = false;
  scoredPaths = new Set();
  lastWords = [];

  // Render and update UI
  renderBoard();
  updateHUD();
  updateTurnBadge();
}

/**
 * Renders all 100 tiles to the grid container.
 * Uses DocumentFragment for performance (no innerHTML in loop).
 * @returns {void}
 */
function renderBoard() {
  const grid = document.getElementById('board');
  if (!grid) return;

  const fragment = document.createDocumentFragment();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const tileEl = createTileElement(r, c);
      fragment.appendChild(tileEl);
    }
  }

  // Clear and append once
  grid.innerHTML = '';
  grid.appendChild(fragment);
}
/**
 * Creates a single tile DOM element with all attributes and listeners.
 * Each tile is a clickable grid cell with proper ARIA labels.
 * @param {number} r - Row index (0-9)
 * @param {number} c - Column index (0-9)
 * @returns {HTMLElement} - The created div element
 */
function createTileElement(r, c) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.dataset.r = r.toString();
  el.dataset.c = c.toString();
  el.setAttribute('role', 'gridcell');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}, empty`);

  // Click handler for placing letter
  el.addEventListener('click', onTileClick);

  // Keyboard accessibility (Enter/Space triggers same action)
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTileClick.call(el, e);
    }
  });

  return el;
}

/**
 * Handles when a player taps an empty tile.
 * Opens the bottom-sheet letter picker modal for selection.
 * @param {Event} e - The click event
 * @returns {void}
 */
function onTileClick(e) {
  // Don't allow clicks if game is over
  if (gameOver) return;

  // In AI mode, don't let human click during AI turn
  if (gameMode === 'vs-ai' && currentTurn === 'p2') return;

  const r = parseInt(this.dataset.r, 10);
  const c = parseInt(this.dataset.c, 10);

  // Block clicking on already-filled tiles
  if (board[r][c].letter !== null) return;

  // Store which tile was tapped, open modal  pendingCell = { r, c };
  showLetterModal();
}

/**
 * Shows the bottom-sheet letter picker modal after tile tap.
 * Populates the 26-letter grid dynamically with DocumentFragment.
 * @returns {void}
 */
function showLetterModal() {
  const grid = document.getElementById('letter-grid');
  if (!grid) return;

  const fragment = document.createDocumentFragment();

  // Build A-Z button row
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // 65 = 'A'
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.textContent = letter;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-label', `Letter ${letter}`);
    btn.addEventListener('click', () => onLetterChosen(letter));
    fragment.appendChild(btn);
  }

  // Replace existing letters
  grid.innerHTML = '';
  grid.appendChild(fragment);

  // Show modal
  document.getElementById('letter-modal').classList.remove('hidden');
}

/**
 * Called when player selects a letter from the modal.
 * Places the letter on the previously-tapped tile.
 * @param {string} letter - Selected letter (A-Z uppercase)
 * @returns {void}
 */
function onLetterChosen(letter) {
  // Hide modal immediately
  document.getElementById('letter-modal').classList.add('hidden');

  if (!pendingCell) return;

  // Place the letter on the board
  placeLetterOnBoard(pendingCell.r, pendingCell.c, letter, currentTurn);
  pendingCell = null;}

/**
 * Places a letter on the board at given coordinates.
 * Runs word detection, updates score if words found, switches turn.
 * @param {number} r - Row index to place
 * @param {number} c - Column index to place
 * @param {string} letter - Letter character to place
 * @param {string} owner - Who placed it ('p1', 'p2', or 'ai')
 * @returns {void}
 */
function placeLetterOnBoard(r, c, letter, owner) {
  // Update board data
  board[r][c].letter = letter;
  board[r][c].owner = owner;

  // Re-render only this one tile (delta rendering - no full board redraw)
  updateTileElement(r, c);

  // If Trie is loaded, detect words
  if (trie) {
    const words = detectWords(board, r, c, trie);

    if (words.length > 0) {
      let points = 0;
      const cellsToFlash = new Set();

      // Process all valid words
      for (const wordObj of words) {
        // Create unique path key for deduplication
        const pathKey = wordObj.cells.map(([rr, cc]) => `${rr},${cc}`).join('|');

        // Skip if this exact path already scored
        if (scoredPaths.has(pathKey)) continue;

        // Mark as scored
        scoredPaths.add(pathKey);
        points += scoreWord(wordObj.word);
        lastWords.push(wordObj.word);

        // Collect cells to flash
        for (const [rr, cc] of wordObj.cells) {
          cellsToFlash.add(`${rr},${cc}`);
        }
      }

      // Award points to correct player
      const scoreOwner = owner === 'ai' ? 'p2' : owner;
      scores[scoreOwner] += points;
      updateHUD();
      // Flash all scored cells with animation
      flashCells(cellsToFlash);

      // Check for win condition before switching turns
      if (checkWin()) return;
    }
  }

  // Normal turn switching
  switchTurn();
}

/**
 * Updates a single tile DOM element without full board re-render.
 * Used for delta rendering optimization — never called in loops.
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @returns {void}
 */
function updateTileElement(r, c) {
  const selector = `.tile[data-r="${r}"][data-c="${c}"]`;
  const el = document.querySelector(selector);
  if (!el) return;

  const cell = board[r][c];

  // Update content and classes
  el.textContent = cell.letter || '';
  el.className = 'tile tile--filled tile--owner-' + cell.owner;

  // Update ARIA label for accessibility
  let ownerLabel = 'empty';
  if (cell.owner === 'p1') ownerLabel = 'Player 1';
  else if (cell.owner === 'ai') ownerLabel = 'AI';
  else if (cell.owner === 'p2') ownerLabel = 'Player 2';

  el.setAttribute('aria-label', `Letter ${cell.letter}, owned by ${ownerLabel}`);
}

/**
 * Animates scored cells with a green flash effect.
 * Uses requestAnimationFrame for GPU-accelerated animations.
 * @param {Set<string>} cellKeys - Set of "row,col" strings to animate
 * @returns {void}
 */
function flashCells(cellKeys) {
  for (const key of cellKeys) {
    const [r, c] = key.split(',').map(Number);
    const selector = `.tile[data-r="${r}"][data-c="${c}"]`;    const el = document.querySelector(selector);
    if (!el) continue;

    // Remove animation class to reset state
    el.classList.remove('tile--scored');

    // Trigger GPU animation via requestAnimationFrame (double-RAF pattern)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('tile--scored');

        // Remove after animation completes so it can re-trigger
        setTimeout(() => {
          el.classList.remove('tile--scored');
        }, 700);
      });
    });
  }
}

/**
 * Detects all valid words formed by a newly placed letter.
 * Scans 8 directions from placed cell, extracts substrings >= 3 chars, validates against Trie.
 * @param {Array<Array<Object>>} boardState - Current board array
 * @param {number} placedRow - Row where letter was placed
 * @param {number} placedCol - Column where letter was placed
 * @param {Object} trieInstance - Loaded Trie dictionary
 * @returns {Array<Object>} - Array of {word, cells} objects
 */
function detectWords(boardState, placedRow, placedCol, trieInstance) {
  // 8 direction vectors: right, left, down, up, and 4 diagonals
  const directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  const found = [];
  const seen = new Set(); // Deduplication within single detection call

  for (const [dr, dc] of directions) {
    // Step 1: Walk backward to find line start
    let startR = placedRow;
    let startC = placedCol;

    while (inBounds(startR - dr, startC - dc) && boardState[startR - dr][startC - dc].letter) {
      startR -= dr;
      startC -= dc;
    }

    // Step 2: Walk forward collecting letters and coordinates    const line = [];
    const coords = [];
    let r = startR;
    let c = startC;

    while (inBounds(r, c) && boardState[r][c].letter) {
      line.push(boardState[r][c].letter);
      coords.push([r, c]);
      r += dr;
      c += dc;
    }

    // Must be at least 3 letters long
    if (line.length < 3) continue;

    // Find where the placed letter sits in this line
    const placedIndex = coords.findIndex(([rr, cc]) => rr === placedRow && cc === placedCol);
    if (placedIndex === -1) continue;

    // Step 3: Extract all substrings >= 3 that include placed index
    for (let start = 0; start <= placedIndex; start++) {
      for (let end = placedIndex + 1; end <= line.length; end++) {
        if (end - start < 3) continue;

        const word = line.slice(start, end).join('');
        const cells = coords.slice(start, end);
        const key = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');

        if (seen.has(key)) continue;
        seen.add(key);

        // Validate with Trie
        if (trieInstance.search(word)) {
          found.push({ word, cells });
        }
      }
    }
  }

  return found;
}

/**
 * Checks if row/column indices are within board bounds (0-9).
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @returns {boolean} - True if within bounds
 */
function inBounds(r, c) {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;}

/**
 * Calculates points earned for a scored word.
 * 3 letters = 1pt, 4 letters = 2pts, 5+ letters = 3pts.
 * @param {string} word - The scored word string
 * @returns {number} - Points value (1, 2, or 3)
 */
function scoreWord(word) {
  const len = word.length;
  if (len >= 5) return 3;
  if (len === 4) return 2;
  return 1;
}

/**
 * Switches turn between players. Triggers AI move in vs-ai mode.
 * Calls AI Select Move wrapped in setTimeout to not block UI paint.
 * @returns {void}
 */
function switchTurn() {
  // Toggle turn
  currentTurn = currentTurn === 'p1' ? 'p2' : 'p1';

  // Update HUD
  updateHUD();
  updateTurnBadge();

  // If vs AI and it's P2's turn (the AI), trigger AI bot
  if (gameMode === 'vs-ai' && currentTurn === 'p2' && typeof window.aiSelectMove === 'function') {
    showAIThinking(true);

    // Always wrap AI in setTimeout to prevent UI blocking
    setTimeout(() => {
      window.aiSelectMove(board, trie, aiDifficulty, (move) => {
        showAIThinking(false);

        // Apply AI move if one was found
        if (move && move.row !== undefined && move.col !== undefined && move.letter) {
          placeLetterOnBoard(move.row, move.col, move.letter, 'ai');
        } else {
          // Fallback: random move if AI fails
          switchTurn();
        }
      });
    }, 0);
  }
}

/** * Checks win condition: 20+ points or board full.
 * Displays win modal if triggered.
 * @returns {boolean} - True if game ended
 */
function checkWin() {
  // Check score-based win first
  if (scores.p1 >= WIN_SCORE || scores.p2 >= WIN_SCORE) {
    const winner = scores.p1 >= WIN_SCORE ? 'Player 1' : 'Player 2';
    showWin(winner);
    return true;
  }

  // Check if board is completely full
  let filledCount = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c].letter) filledCount++;
    }
  }

  if (filledCount === BOARD_SIZE * BOARD_SIZE) {
    // Draw by highest score
    let winner;
    if (scores.p1 > scores.p2) winner = 'Player 1';
    else if (scores.p2 > scores.p1) winner = 'Player 2';
    else winner = 'Nobody';

    showWin(winner);
    return true;
  }

  return false;
}

/**
 * Displays the victory screen with final scores and winner.
 * Uses the win modal overlay with HARVEST RESULT badge.
 * @param {string} winner - Winner name or 'Nobody' for tie
 * @returns {void}
 */
function showWin(winner) {
  gameOver = true;

  const titleEl = document.getElementById('win-title');
  const scoresEl = document.getElementById('win-scores');
  const badgeEl = document.getElementById('win-badge');

  // Set title and badge based on outcome
  if (winner === 'Nobody') {
    titleEl.textContent = "It's a Tie!";    badgeEl.textContent = 'HARVEST RESULT';
  } else {
    titleEl.textContent = winner + ' Wins!';
    badgeEl.textContent = 'VICTORY';
  }

  // Show final scores
  scoresEl.textContent = `${scores.p1} – ${scores.p2}`;

  // Highlight last word if available
  if (lastWords.length > 0) {
    const lastWord = lastWords[lastWords.length - 1];
    const pts = scoreWord(lastWord);
    const lastWordEl = document.getElementById('win-last-word');
    if (lastWordEl) {
      lastWordEl.textContent = `Last word: "${lastWord}" (+${pts} pts)`;
      lastWordEl.style.display = 'block';
    }
  }

  // Show modal
  document.getElementById('win-modal').classList.remove('hidden');
}

/**
 * Updates the HUD to display current scores and progress bars.
 * Progress bar shows percentage toward WIN_SCORE target (20).
 * @returns {void}
 */
function updateHUD() {
  const p1ScoreEl = document.getElementById('p1-score');
  const p2ScoreEl = document.getElementById('p2-score');
  const p1ProgressEl = document.getElementById('p1-progress');
  const p2ProgressEl = document.getElementById('p2-progress');

  if (p1ScoreEl) p1ScoreEl.textContent = scores.p1.toString();
  if (p2ScoreEl) p2ScoreEl.textContent = scores.p2.toString();

  if (p1ProgressEl) {
    const pct = Math.min((scores.p1 / WIN_SCORE) * 100, 100);
    p1ProgressEl.style.width = pct + '%';
  }

  if (p2ProgressEl) {
    const pct = Math.min((scores.p2 / WIN_SCORE) * 100, 100);
    p2ProgressEl.style.width = pct + '%';
  }
}

/** * Updates the turn indicator badge text.
 * Shows "YOUR TURN", "AI TURN", or "OPPONENT TURN".
 * @returns {void}
 */
function updateTurnBadge() {
  const badge = document.getElementById('turn-badge');
  if (!badge) return;

  if (currentTurn === 'p1') {
    badge.textContent = 'YOUR TURN';
  } else if (gameMode === 'vs-ai') {
    badge.textContent = 'AI TURN';
  } else {
    badge.textContent = 'OPPONENT TURN';
  }
}

/**
 * Shows or hides the AI thinking indicator bubble.
 * @param {boolean} show - True to show loading state
 * @returns {void}
 */
function showAIThinking(show) {
  const el = document.getElementById('ai-thinking');
  if (!el) return;

  if (show) {
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

/**
 * Resets the game to initial state.
 * Clears win modal and starts fresh board.
 * @returns {void}
 */
function resetGame() {
  document.getElementById('win-modal').classList.add('hidden');
  initBoard();
}

/**
 * Shows the main menu overlay again.
 * Returns player to game selection screen.
 * @returns {void}
 */
function showMenu() {
  document.getElementById('win-modal').classList.add('hidden');  document.getElementById('menu-overlay').classList.remove('hidden');
  gameOver = true;
}

/**
 * Starts a new game with specified mode and difficulty.
 * Hides menu overlay, sets game parameters, initializes board.
 * @param {string} mode - 'vs-ai' or 'vs-human'
 * @param {string} difficulty - 'easy', 'medium', or 'hard'
 * @returns {void}
 */
function startGame(mode, difficulty) {
  gameMode = mode;
  aiDifficulty = difficulty;

  // Hide menu
  document.getElementById('menu-overlay').classList.add('hidden');

  // Update opponent label based on mode
  const p2Label = document.getElementById('p2-label');
  if (p2Label) {
    p2Label.textContent = mode === 'vs-ai' ? 'AI' : 'OPPONENT';
  }

  // Ready for gameplay
  gameOver = false;
  initBoard();
}

/**
 * Sets up all DOM event listeners for the game.
 * Modal controls, buttons, keyboard events, etc.
 * @returns {void}
 */
function initEventListeners() {
  // --- Letter Modal Controls ---
  const modalCancel = document.getElementById('modal-cancel');
  const modalClose = document.getElementById('modal-close');
  const modalPlace = document.getElementById('modal-place');

  if (modalCancel) {
    modalCancel.addEventListener('click', () => {
      document.getElementById('letter-modal').classList.add('hidden');
      pendingCell = null;
    });
  }

  if (modalClose) {
    modalClose.addEventListener('click', () => {
      document.getElementById('letter-modal').classList.add('hidden');      pendingCell = null;
    });
  }

  if (modalPlace) {
    modalPlace.addEventListener('click', () => {
      document.getElementById('letter-modal').classList.add('hidden');
      if (pendingCell) {
        // Default to 'E' if user wants quick placement without selecting
        placeLetterOnBoard(pendingCell.r, pendingCell.c, 'E', currentTurn);
        pendingCell = null;
      }
    });
  }

  // --- Win Modal Controls ---
  const playAgainBtn = document.getElementById('play-again');
  const returnRootsBtn = document.getElementById('return-roots');

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', resetGame);
  }

  if (returnRootsBtn) {
    returnRootsBtn.addEventListener('click', showMenu);
  }

  // --- Menu Difficulty Selection ---
  const diffButtons = document.querySelectorAll('.diff-btn');
  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Deselect all
      diffButtons.forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-checked', 'false');
      });

      // Select this one
      btn.classList.add('selected');
      btn.setAttribute('aria-checked', 'true');
      aiDifficulty = btn.dataset.diff;
    });
  });

  // --- Menu Play Buttons ---
  const playAiBtn = document.getElementById('menu-play-ai');
  const playFriendBtn = document.getElementById('menu-play-friend');

  if (playAiBtn) {
    playAiBtn.addEventListener('click', () => {      startGame('vs-ai', aiDifficulty);
    });
  }

  if (playFriendBtn) {
    playFriendBtn.addEventListener('click', () => {
      startGame('vs-human', aiDifficulty);
    });
  }

  // --- Action Bar Buttons ---
  const regrowBtn = document.getElementById('btn-regrow');
  const senseBtn = document.getElementById('btn-sense');

  if (regrowBtn) {
    regrowBtn.addEventListener('click', () => {
      // Regrow: clear board and restart
      const confirmMsg = confirm('🌱 REGROW: This will reset the board. Continue?');
      if (confirmMsg) {
        initBoard();
      }
    });
  }

  if (senseBtn) {
    senseBtn.addEventListener('click', () => {
      // SENSE: Show hint (placeholder functionality)
      const hintBar = document.getElementById('hint-bar-text');
      if (hintBar) {
        hintBar.textContent = 'SENSE: Look for opportunities to form 5+ letter words!';
      }
      alert('💡 SENSE: When the forest feels quiet, use Sense to reveal a hidden word path.');
    });
  }
}

/**
 * Main initialization function.
 * Called when DOM is ready. Builds Trie, then starts game.
 * @returns {void}
 */
function init() {
  // Attach all event listeners
  initEventListeners();

  // Build Trie dictionary asynchronously (non-blocking)
  // Pass callback to start game when dictionary is ready
  buildTrieAsync((loadedTrie) => {
    trie = loadedTrie;
    initBoard();  });
}

// DOMContentLoaded guard — ensures DOM is ready before execution
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
