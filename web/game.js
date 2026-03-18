/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 *
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 *
 * Free for personal/non-commercial use.
 * Commercial use requires a 27% gross revenue royalty agreement.
 * Attribution to the original author is mandatory in all derivatives.
 */
'use strict';

/* ==========================================================
   GAME STATE
   ========================================================== */
let board        = [];
let currentTurn  = 'p1';
let scores       = { p1: 0, p2: 0 };
let trie         = null;
let gameOver     = false;
let pendingCell  = null;
let scoredPaths  = new Set();
let gameMode     = 'vs-ai';       // 'vs-ai' | 'vs-human' — set by home screen
let aiDifficulty = 'medium';      // 'easy' | 'medium' | 'hard' — set by home screen
let lastWord     = '';

const WIN_SCORE = 20;

/* ==========================================================
   SCREEN MANAGEMENT
   ========================================================== */

/**
 * Shows one screen, hides the other.
 * @param {'home'|'game'} screen
 */
function showScreen(screen) {
  document.getElementById('home-screen').classList.toggle('hidden', screen !== 'home');
  document.getElementById('game-screen').classList.toggle('hidden', screen !== 'game');
}

/* ==========================================================
   HOME SCREEN WIRING
   ========================================================== */

/** Reads which difficulty button is active and returns it. */
function getSelectedDifficulty() {
  const active = document.querySelector('.diff-btn--active');
  return active ? active.dataset.diff : 'medium';
}

/** Wires up all home screen interactive elements. */
function initHomeScreen() {

  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.remove('diff-btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('diff-btn--active');
      btn.setAttribute('aria-pressed', 'true');
      aiDifficulty = btn.dataset.diff;
    });
  });

  // VS AI
  document.getElementById('btn-vs-ai').addEventListener('click', () => {
    if (!trie) return; // dict not ready yet
    gameMode     = 'vs-ai';
    aiDifficulty = getSelectedDifficulty();
    document.getElementById('p2-label').textContent = 'AI';
    startGame();
  });

  // VS Friend
  document.getElementById('btn-vs-friend').addEventListener('click', () => {
    if (!trie) return;
    gameMode = 'vs-human';
    document.getElementById('p2-label').textContent = 'GUEST';
    startGame();
  });

  // Theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const root    = document.documentElement;
      const current = root.getAttribute('data-theme');
      const next    = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('wpb-theme', next);
      themeBtn.textContent = next === 'dark' ? '☀' : '☾';
    });
  }

  // Settings / How to play stubs — Phase 2
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', () => {
    alert('Settings coming in Phase 2!');
  });

  const howBtn = document.getElementById('btn-how-to-play');
  if (howBtn) howBtn.addEventListener('click', () => {
    alert('How to Play:\n\n1. Tap any empty tile\n2. Choose a letter to plant\n3. Form words of 3+ letters in any direction\n4. First to 20 points wins!');
  });
}

/* ==========================================================
   GAME LIFECYCLE
   ========================================================== */

/** Transitions from home to game screen and resets state. */
function startGame() {
  showScreen('game');
  board       = [];
  scores      = { p1: 0, p2: 0 };
  currentTurn = 'p1';
  gameOver    = false;
  pendingCell = null;
  scoredPaths = new Set();
  lastWord    = '';
  renderBoard();
  updateHUD();

  // If vs-ai and AI goes first somehow, trigger it
  if (gameMode === 'vs-ai' && currentTurn === 'p2') triggerAI();
}

/** Returns to home screen. */
function goHome() {
  document.getElementById('win-modal').classList.add('hidden');
  document.getElementById('letter-modal').classList.add('hidden');
  showScreen('home');
}

/* ==========================================================
   BOARD RENDER
   ========================================================== */

/** Builds the 10×10 board array and renders all tiles. */
function renderBoard() {
  board = [];
  for (let r = 0; r < 10; r++) {
    board[r] = [];
    for (let c = 0; c < 10; c++) {
      board[r][c] = { letter: null, owner: null, row: r, col: c };
    }
  }

  const grid = document.getElementById('board');
  const frag = document.createDocumentFragment();
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      frag.appendChild(createTileEl(r, c));
    }
  }
  grid.innerHTML = '';
  grid.appendChild(frag);
}

/**
 * Creates a single tile element.
 * @param {number} r
 * @param {number} c
 * @returns {HTMLElement}
 */
function createTileEl(r, c) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.dataset.r = r;
  el.dataset.c = c;
  el.setAttribute('role', 'gridcell');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}, empty`);
  el.addEventListener('click', onTileClick);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTileClick.call(el, e);
    }
  });
  return el;
}

/* ==========================================================
   TILE INTERACTION
   ========================================================== */

/** Handles tile tap — opens letter picker. */
function onTileClick() {
  if (gameOver) return;
  if (gameMode === 'vs-ai' && currentTurn === 'p2') return; // AI's turn
  const r = parseInt(this.dataset.r);
  const c = parseInt(this.dataset.c);
  if (board[r][c].letter) return; // already filled
  pendingCell = { r, c };
  showLetterModal(r, c);
}

/**
 * Opens the letter picker bottom sheet.
 * @param {number} r
 * @param {number} c
 */
function showLetterModal(r, c) {
  const grid = document.getElementById('letter-grid');
  const frag = document.createDocumentFragment();

  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const btn    = document.createElement('button');
    btn.className   = 'letter-btn';
    btn.textContent = letter;
    btn.setAttribute('aria-label', `Plant letter ${letter}`);
    btn.addEventListener('click', () => onLetterChosen(letter));
    frag.appendChild(btn);
  }

  grid.innerHTML = '';
  grid.appendChild(frag);
  document.getElementById('letter-modal').classList.remove('hidden');
}

/** Called when player taps a letter in the picker. */
function onLetterChosen(letter) {
  document.getElementById('letter-modal').classList.add('hidden');
  if (!pendingCell) return;
  placeLetterOnBoard(pendingCell.r, pendingCell.c, letter, currentTurn);
  pendingCell = null;
}

/* ==========================================================
   CORE GAME LOGIC
   ========================================================== */

/**
 * Places a letter, runs word detection, updates score, switches turn.
 * @param {number} r
 * @param {number} c
 * @param {string} letter
 * @param {string} owner  — 'p1' | 'p2' | 'ai'
 */
function placeLetterOnBoard(r, c, letter, owner) {
  board[r][c].letter = letter;
  board[r][c].owner  = owner;
  updateTileEl(r, c);

  if (trie) {
    const words = detectWords(board, r, c, trie);
    if (words.length > 0) {
      let pts = 0;
      const cellsToFlash = new Set();

      for (const { word, cells } of words) {
        const key = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');
        if (scoredPaths.has(key)) continue;
        scoredPaths.add(key);
        pts += scoreWord(word);
        lastWord = word;
        for (const [rr, cc] of cells) cellsToFlash.add(`${rr},${cc}`);
      }

      // AI scores to p2 bucket
      const scoreOwner = owner === 'ai' ? 'p2' : owner;
      scores[scoreOwner] += pts;
      updateHUD();
      flashCells(cellsToFlash);
      if (checkWin()) return;
    }
  }

  switchTurn();
}

/** Updates a single tile's DOM without re-rendering the full board. */
function updateTileEl(r, c) {
  const el   = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  if (!el) return;
  const cell = board[r][c];
  el.textContent = cell.letter || '';
  el.className   = `tile tile--filled tile--owner-${cell.owner}`;
  const ownerName = cell.owner === 'p1' ? 'Player 1'
                  : cell.owner === 'ai' ? 'AI'
                  : 'Player 2';
  el.setAttribute('aria-label', `Letter ${cell.letter}, owned by ${ownerName}`);
}

/**
 * Flashes scored tiles using rAF (GPU transform only).
 * @param {Set<string>} cellKeys
 */
function flashCells(cellKeys) {
  for (const key of cellKeys) {
    const [r, c] = key.split(',').map(Number);
    const el = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
    if (!el) continue;
    el.classList.remove('tile--scored');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('tile--scored');
      setTimeout(() => el.classList.remove('tile--scored'), 700);
    }));
  }
}

/* ==========================================================
   WORD DETECTION
   ========================================================== */

/**
 * Scans 8 directions from the placed cell and returns all valid words.
 * @param {Array}  board
 * @param {number} placedRow
 * @param {number} placedCol
 * @param {Object} trie
 * @returns {{ word: string, cells: [number,number][] }[]}
 */
function detectWords(board, placedRow, placedCol, trie) {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  const found = [];
  const seen  = new Set();

  for (const [dr, dc] of DIRS) {
    // Walk backward to line start
    let sr = placedRow, sc = placedCol;
    while (inBounds(sr - dr, sc - dc) && board[sr - dr][sc - dc].letter) {
      sr -= dr; sc -= dc;
    }

    // Collect the full line
    const line = [], coords = [];
    let r = sr, c = sc;
    while (inBounds(r, c) && board[r][c].letter) {
      line.push(board[r][c].letter);
      coords.push([r, c]);
      r += dr; c += dc;
    }

    if (line.length < 3) continue;

    // Find placed letter's index in this line
    const pi = coords.findIndex(([rr, cc]) => rr === placedRow && cc === placedCol);
    if (pi === -1) continue;

    // Extract all substrings ≥ 3 that include the placed index
    for (let s = 0; s <= pi; s++) {
      for (let e = pi + 1; e <= line.length; e++) {
        if (e - s < 3) continue;
        const word  = line.slice(s, e).join('');
        const cells = coords.slice(s, e);
        const key   = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        if (trie.search(word)) found.push({ word, cells });
      }
    }
  }

  return found;
}

/**
 * @param {number} r
 * @param {number} c
 * @returns {boolean}
 */
function inBounds(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 10; }

/**
 * Points for a word per spec Section 6.
 * @param {string} word
 * @returns {number}
 */
function scoreWord(word) {
  return word.length >= 5 ? 3 : word.length === 4 ? 2 : 1;
}

/* ==========================================================
   TURN & WIN
   ========================================================== */

/** Switches active player and fires AI if needed. */
function switchTurn() {
  currentTurn = currentTurn === 'p1' ? 'p2' : 'p1';
  updateHUD();
  if (gameMode === 'vs-ai' && currentTurn === 'p2') triggerAI();
}

/** Wraps AI call in setTimeout to never block UI paint. */
function triggerAI() {
  showAIThinking(true);
  setTimeout(() => {
    if (typeof aiSelectMove === 'function') {
      aiSelectMove(board, trie, aiDifficulty, move => {
        showAIThinking(false);
        placeLetterOnBoard(move.row, move.col, move.letter, 'ai');
      });
    }
  }, 0);
}

/**
 * Checks win conditions.
 * @returns {boolean}
 */
function checkWin() {
  if (scores.p1 >= WIN_SCORE || scores.p2 >= WIN_SCORE) {
    const winner = scores.p1 >= WIN_SCORE ? 'YOU' : (gameMode === 'vs-ai' ? 'AI' : 'GUEST');
    showWin(winner);
    return true;
  }
  let filled = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (board[r][c].letter) filled++;
  if (filled === 100) {
    const winner = scores.p1 > scores.p2 ? 'YOU'
                 : scores.p2 > scores.p1 ? (gameMode === 'vs-ai' ? 'AI' : 'GUEST')
                 : 'NOBODY';
    showWin(winner);
    return true;
  }
  return false;
}

/**
 * Shows win modal with result.
 * @param {string} winner
 */
function showWin(winner) {
  gameOver = true;
  const titleEl     = document.getElementById('win-title');
  const scoresEl    = document.getElementById('win-scores');
  const lastWordEl  = document.getElementById('win-last-word');

  titleEl.textContent    = winner === 'NOBODY' ? "IT'S A TIE" : `${winner} WINS`;
  scoresEl.textContent   = `${scores.p1} – ${scores.p2}`;
  lastWordEl.textContent = lastWord ? `Last word: ${lastWord}` : '';

  document.getElementById('win-modal').classList.remove('hidden');
}

/* ==========================================================
   HUD
   ========================================================== */

/** Syncs all HUD elements to current game state. */
function updateHUD() {
  document.getElementById('p1-score').textContent = scores.p1;
  document.getElementById('p2-score').textContent = scores.p2;

  const p1Pct = Math.min(scores.p1 / WIN_SCORE * 100, 100);
  const p2Pct = Math.min(scores.p2 / WIN_SCORE * 100, 100);
  document.getElementById('p1-progress').style.width = p1Pct + '%';
  document.getElementById('p2-progress').style.width = p2Pct + '%';

  // aria-valuenow for progress bars
  const p1Bar = document.querySelector('#p1-card .progress-bar');
  const p2Bar = document.querySelector('#p2-card .progress-bar');
  if (p1Bar) p1Bar.setAttribute('aria-valuenow', scores.p1);
  if (p2Bar) p2Bar.setAttribute('aria-valuenow', scores.p2);

  const badge = document.getElementById('turn-badge');
  if (gameOver) {
    badge.textContent = 'GAME OVER';
  } else if (gameMode === 'vs-ai') {
    badge.textContent = currentTurn === 'p1' ? 'YOUR TURN' : 'AI TURN';
  } else {
    badge.textContent = currentTurn === 'p1' ? 'P1 TURN' : 'P2 TURN';
  }
}

/** Shows/hides AI thinking pill. */
function showAIThinking(show) {
  document.getElementById('ai-thinking').classList.toggle('hidden', !show);
}

/* ==========================================================
   MODAL CONTROLS
   ========================================================== */

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('letter-modal').classList.add('hidden');
  pendingCell = null;
});

document.getElementById('play-again').addEventListener('click', () => {
  document.getElementById('win-modal').classList.add('hidden');
  startGame();
});

document.getElementById('win-home').addEventListener('click', goHome);

document.getElementById('btn-home').addEventListener('click', () => {
  if (gameOver || confirm('Leave this game and return to menu?')) goHome();
});

/* ==========================================================
   BOOT SEQUENCE
   ========================================================== */

// Wire home screen buttons
initHomeScreen();

// Start on home screen
showScreen('home');

// Load dictionary — shows loading spinner until ready,
// then reveals the play buttons
buildTrieAsync(t => {
  trie = t;

  // Hide loading, show play buttons
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('menu-body').classList.remove('hidden');
});  applyTheme(saved || preferred);
}

/**
 * Applies theme and updates toggle button label.
 * @param {string} theme — 'dark' | 'light'
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wpb-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
}

/* ═══════════════════════════════════
   SCREEN TRANSITIONS
═══════════════════════════════════ */

/**
 * Shows the home screen, hides game screen.
 * Resets game state so a fresh game starts cleanly.
 */
function showHome() {
  document.getElementById('home-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('win-modal').classList.add('hidden');
}

/**
 * Shows the game screen, hides home screen.
 */
function showGame() {
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
}

/**
 * Called when a Play button is pressed.
 * Sets game mode + difficulty, initialises the board.
 * @param {string} mode        — 'vs-ai' | 'vs-human'
 * @param {string} difficulty  — 'easy' | 'medium' | 'hard'
 */
function startGame(mode, difficulty) {
  GAME_MODE     = mode;
  AI_DIFFICULTY = difficulty;

  // Update P2 label to reflect who they're playing
  document.getElementById('p2-label').textContent =
    mode === 'vs-ai' ? 'AI' : 'Player 2';

  showGame();
  initBoard();
}

/* ═══════════════════════════════════
   BOARD
═══════════════════════════════════ */

/**
 * Builds the 10×10 board array and renders all tiles.
 */
function initBoard() {
  board = [];
  for (let r = 0; r < 10; r++) {
    board[r] = [];
    for (let c = 0; c < 10; c++) {
      board[r][c] = { letter: null, owner: null, row: r, col: c, highlighted: false };
    }
  }
  scores      = { p1: 0, p2: 0 };
  currentTurn = 'p1';
  gameOver    = false;
  scoredPaths = new Set();
  lastWord    = '';
  renderBoard();
  updateHUD();
}

/**
 * Renders all 100 tiles into the board grid using a DocumentFragment.
 * Called once on init; subsequent updates go through updateTileEl().
 */
function renderBoard() {
  const grid = document.getElementById('board');
  const frag = document.createDocumentFragment();
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      frag.appendChild(createTileEl(r, c));
    }
  }
  grid.innerHTML = '';
  grid.appendChild(frag);
}

/**
 * Creates a single tile DOM element.
 * @param {number} r
 * @param {number} c
 * @returns {HTMLElement}
 */
function createTileEl(r, c) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.dataset.r = r;
  el.dataset.c = c;
  el.setAttribute('role', 'gridcell');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Row ${r + 1}, Column ${c + 1}, empty`);
  el.addEventListener('click', onTileClick);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTileClick.call(el, e);
    }
  });
  return el;
}

/* ═══════════════════════════════════
   TILE INTERACTION
═══════════════════════════════════ */

/**
 * Handles a tile click or keypress.
 * Ignores filled cells, the wrong player's turn, or a finished game.
 */
function onTileClick() {
  if (gameOver) return;
  // Block P1 from clicking during AI turn
  if (currentTurn === 'p2' && GAME_MODE === 'vs-ai') return;
  const r = parseInt(this.dataset.r, 10);
  const c = parseInt(this.dataset.c, 10);
  if (board[r][c].letter) return;
  pendingCell = { r, c };
  showLetterModal();
}

/**
 * Builds and opens the bottom-sheet letter picker.
 */
function showLetterModal() {
  const grid = document.getElementById('letter-grid');
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    const btn = document.createElement('button');
    btn.className = 'letter-btn';
    btn.textContent = letter;
    btn.setAttribute('aria-label', `Place letter ${letter}`);
    btn.addEventListener('click', () => onLetterChosen(letter));
    frag.appendChild(btn);
  }
  grid.innerHTML = '';
  grid.appendChild(frag);
  document.getElementById('letter-modal').classList.remove('hidden');
  // Focus first button for keyboard users
  requestAnimationFrame(() => grid.querySelector('.letter-btn')?.focus());
}

/**
 * Called when a letter button is tapped in the picker.
 * @param {string} letter
 */
function onLetterChosen(letter) {
  document.getElementById('letter-modal').classList.add('hidden');
  if (!pendingCell) return;
  placeLetterOnBoard(pendingCell.r, pendingCell.c, letter, currentTurn);
  pendingCell = null;
}

/* ═══════════════════════════════════
   PLACEMENT & SCORING
═══════════════════════════════════ */

/**
 * Places a letter on the board, detects words, updates scores,
 * then switches turn (or triggers AI).
 * @param {number} r
 * @param {number} c
 * @param {string} letter
 * @param {string} owner — 'p1' | 'p2' | 'ai'
 */
function placeLetterOnBoard(r, c, letter, owner) {
  board[r][c].letter = letter;
  board[r][c].owner  = owner;
  updateTileEl(r, c);

  if (trie) {
    const words = detectWords(board, r, c, trie);
    if (words.length > 0) {
      let pts = 0;
      const cellsToFlash = new Set();

      for (const { word, cells } of words) {
        const key = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');
        if (scoredPaths.has(key)) continue;
        scoredPaths.add(key);
        pts += scoreWord(word);
        lastWord = word;
        for (const [rr, cc] of cells) cellsToFlash.add(`${rr},${cc}`);
      }

      // AI tiles score to P2
      const scoreOwner = owner === 'ai' ? 'p2' : owner;
      scores[scoreOwner] += pts;
      updateHUD();
      flashCells(cellsToFlash);
      if (checkWin()) return;
    }
  }

  switchTurn();
}

/**
 * Updates a single tile element to reflect board state.
 * Only touches the one changed cell — never re-renders full board.
 * @param {number} r
 * @param {number} c
 */
function updateTileEl(r, c) {
  const el = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  if (!el) return;
  const cell = board[r][c];
  el.textContent = cell.letter || '';
  el.className = `tile tile--filled tile--owner-${cell.owner}`;
  const ownerName = cell.owner === 'p1' ? 'Player 1'
                  : cell.owner === 'ai'  ? 'AI'
                  : 'Player 2';
  el.setAttribute('aria-label', `Letter ${cell.letter}, owned by ${ownerName}`);
  el.removeAttribute('tabindex');
}

/**
 * Flashes scored cells using requestAnimationFrame (GPU-only: transform + opacity).
 * @param {Set<string>} cellKeys — Set of "r,c" strings
 */
function flashCells(cellKeys) {
  for (const key of cellKeys) {
    const [r, c] = key.split(',').map(Number);
    const el = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
    if (!el) continue;
    el.classList.remove('tile--scored');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('tile--scored');
      setTimeout(() => el.classList.remove('tile--scored'), 700);
    }));
  }
}

/* ═══════════════════════════════════
   WORD DETECTION
═══════════════════════════════════ */

/**
 * Scans all 8 directions from the newly placed cell.
 * Finds every substring ≥ 3 letters that passes trie.search().
 * Uses a path-key Set to prevent reporting the same physical path twice.
 *
 * @param {Array}  board
 * @param {number} placedRow
 * @param {number} placedCol
 * @param {Object} trie
 * @returns {Array<{word:string, cells:Array}>}
 */
function detectWords(board, placedRow, placedCol, trie) {
  const dirs  = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  const found = [];
  const seen  = new Set();

  for (const [dr, dc] of dirs) {
    // Walk backward to line start
    let sr = placedRow, sc = placedCol;
    while (inBounds(sr - dr, sc - dc) && board[sr - dr][sc - dc].letter) {
      sr -= dr; sc -= dc;
    }

    // Collect full line
    const line = [], coords = [];
    let r = sr, c = sc;
    while (inBounds(r, c) && board[r][c].letter) {
      line.push(board[r][c].letter);
      coords.push([r, c]);
      r += dr; c += dc;
    }

    if (line.length < 3) continue;

    // Index of the placed cell in this line
    const pi = coords.findIndex(([rr, cc]) => rr === placedRow && cc === placedCol);
    if (pi === -1) continue;

    // Extract all substrings ≥ 3 that include the placed letter
    for (let s = 0; s <= pi; s++) {
      for (let e = pi + 1; e <= line.length; e++) {
        if (e - s < 3) continue;
        const word  = line.slice(s, e).join('');
        const cells = coords.slice(s, e);
        const key   = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        if (trie.search(word)) found.push({ word, cells });
      }
    }
  }

  return found;
}

/**
 * @param {number} r
 * @param {number} c
 * @returns {boolean}
 */
function inBounds(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 10; }

/**
 * Returns points for a word by length.
 * @param {string} word
 * @returns {number}
 */
function scoreWord(word) {
  return word.length >= 5 ? 3 : word.length === 4 ? 2 : 1;
}

/* ═══════════════════════════════════
   TURN MANAGEMENT
═══════════════════════════════════ */

/**
 * Switches active player and triggers AI move if needed.
 */
function switchTurn() {
  currentTurn = currentTurn === 'p1' ? 'p2' : 'p1';
  updateHUD();

  if (currentTurn === 'p2' && GAME_MODE === 'vs-ai') {
    if (typeof aiSelectMove !== 'function') {
      console.warn('[WPB] ai-bot.js not loaded — skipping AI turn');
      switchTurn(); // skip back
      return;
    }
    showAIThinking(true);
    aiSelectMove(board, trie, AI_DIFFICULTY, move => {
      showAIThinking(false);
      placeLetterOnBoard(move.row, move.col, move.letter, 'ai');
    });
  }
}

/* ═══════════════════════════════════
   WIN CONDITION
═══════════════════════════════════ */

/**
 * Checks whether the game is over.
 * @returns {boolean}
 */
function checkWin() {
  if (scores.p1 >= WIN_SCORE || scores.p2 >= WIN_SCORE) {
    showWinModal(scores.p1 >= WIN_SCORE ? 'Player 1' : (GAME_MODE === 'vs-ai' ? 'AI' : 'Player 2'));
    return true;
  }

  let filled = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (board[r][c].letter) filled++;
  if (filled === 100) {
    const winner = scores.p1 > scores.p2 ? 'Player 1'
                 : scores.p2 > scores.p1 ? (GAME_MODE === 'vs-ai' ? 'AI' : 'Player 2')
                 : 'Nobody';
    showWinModal(winner);
    return true;
  }

  return false;
}

/**
 * Shows the win modal with result + last scored word.
 * @param {string} winner
 */
function showWinModal(winner) {
  gameOver = true;
  document.getElementById('win-title').textContent =
    winner === 'Nobody' ? "It's a tie!" : `${winner} Wins!`;
  document.getElementById('win-scores').textContent = `${scores.p1} – ${scores.p2}`;
  document.getElementById('win-last-word').textContent =
    lastWord ? `Last word: ${lastWord}` : '';
  document.getElementById('win-modal').classList.remove('hidden');
}

/* ═══════════════════════════════════
   HUD
═══════════════════════════════════ */

/**
 * Updates scores, progress bars, and turn badge.
 */
function updateHUD() {
  document.getElementById('p1-score').textContent = scores.p1;
  document.getElementById('p2-score').textContent = scores.p2;

  const p1Pct = Math.min((scores.p1 / WIN_SCORE) * 100, 100);
  const p2Pct = Math.min((scores.p2 / WIN_SCORE) * 100, 100);
  const p1Bar = document.getElementById('p1-progress');
  const p2Bar = document.getElementById('p2-progress');
  p1Bar.style.width = p1Pct + '%';
  p2Bar.style.width = p2Pct + '%';
  p1Bar.parentElement.setAttribute('aria-valuenow', scores.p1);
  p2Bar.parentElement.setAttribute('aria-valuenow', scores.p2);

  let badgeText;
  if (currentTurn === 'p1') {
    badgeText = 'P1 Turn';
  } else if (GAME_MODE === 'vs-ai') {
    badgeText = 'AI Turn';
  } else {
    badgeText = 'P2 Turn';
  }
  document.getElementById('turn-badge').textContent = badgeText;
}

/**
 * Shows/hides the AI thinking pill.
 * @param {boolean} show
 */
function showAIThinking(show) {
  document.getElementById('ai-thinking').classList.toggle('hidden', !show);
}

/* ═══════════════════════════════════
   EVENT LISTENERS
═══════════════════════════════════ */

// Letter modal — cancel button
document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('letter-modal').classList.add('hidden');
  pendingCell = null;
});

// Win modal — play again (same mode/difficulty)
document.getElementById('play-again').addEventListener('click', () => {
  document.getElementById('win-modal').classList.add('hidden');
  initBoard();
});

// Win modal — back to menu
document.getElementById('win-home').addEventListener('click', () => {
  showHome();
});

// HUD — home button
document.getElementById('btn-home').addEventListener('click', () => {
  showHome();
});

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.remove('diff-btn--active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('diff-btn--active');
    btn.setAttribute('aria-pressed', 'true');
  });
});

// Play buttons
document.getElementById('btn-vs-ai').addEventListener('click', () => {
  const diff = document.querySelector('.diff-btn--active')?.dataset.diff || 'medium';
  startGame('vs-ai', diff);
});

document.getElementById('btn-vs-friend').addEventListener('click', () => {
  startGame('vs-human', 'medium');
});

// Close letter modal on overlay tap (outside bottom sheet)
document.getElementById('letter-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('letter-modal').classList.add('hidden');
    pendingCell = null;
  }
});

/* ═══════════════════════════════════
   BOOT SEQUENCE
═══════════════════════════════════ */

// Apply theme before any paint
initTheme();

// Load dictionary, then reveal the menu
buildTrieAsync(
  t => {
    trie = t;
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('menu-body').classList.remove('hidden');
  },
  err => {
    // Dictionary failed — still show menu but word detection won't work
    console.error('[WPB] Dictionary failed to load:', err);
    const loadEl = document.getElementById('loading-state');
    loadEl.querySelector('span').textContent = '⚠ Dictionary unavailable — scoring disabled';
    document.getElementById('menu-body').classList.remove('hidden');
  }
);
