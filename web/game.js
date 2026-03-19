/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 *
 * Free for personal/non-commercial use.
 * Commercial use requires a 27% gross revenue royalty agreement.
 * Attribution to the original author is mandatory in all derivatives.
 */
'use strict';

/* ==========================================================
   STATE
   ========================================================== */
let board        = [];
let currentTurn  = 'p1';
let scores       = { p1: 0, p2: 0 };
let trie         = null;
let gameOver     = false;
let pendingCell  = null;
let scoredPaths  = new Set();
let gameMode     = 'vs-ai';
let aiDifficulty = 'medium';
let lastWord     = '';

const WIN_SCORE = 20;

/* ==========================================================
   TAB BAR
   ========================================================== */

/**
 * Switches the active tab panel and updates ARIA state.
 * Blocked during active gameplay — the board is full-screen.
 * @param {string} targetTab  — data-tab value
 */
function switchToTab(targetTab) {
  // Guard: no tab switching while a game is in progress
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen && !gameScreen.classList.contains('hidden')) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === targetTab;
    btn.classList.toggle('tab-btn--active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.tab !== targetTab);
  });
}

/** Wires every tab button. Called once at boot. */
function initTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchToTab(btn.dataset.tab));
  });
}

/* ==========================================================
   SCREENS
   ========================================================== */

/**
 * Switches between home and game screen.
 * Also shows/hides the tab bar — hidden during gameplay
 * so the board can use the full viewport height.
 * @param {'home'|'game'} screen
 */
function showScreen(screen) {
  document.getElementById('home-screen').classList.toggle('hidden', screen !== 'home');
  document.getElementById('game-screen').classList.toggle('hidden', screen !== 'game');

  // Tab bar disappears during gameplay for full-screen focus
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.classList.toggle('tab-bar--hidden', screen === 'game');
}

/* ==========================================================
   HOME SCREEN BUTTONS
   ========================================================== */

/** @returns {string} */
function getSelectedDifficulty() {
  const a = document.querySelector('.diff-btn--active');
  return a ? a.dataset.diff : 'medium';
}

/**
 * Wires all home screen, settings, and in-game buttons.
 * Called ONCE at the bottom of this file.
 */
function initHomeScreen() {

  // ── Difficulty toggle ─────────────────────────────────────
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.remove('diff-btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('diff-btn--active');
      btn.setAttribute('aria-pressed', 'true');
      aiDifficulty = btn.dataset.diff;
      localStorage.setItem('wpb-difficulty', btn.dataset.diff);
    });
  });

  // Restore saved difficulty selection
  const savedDiff = localStorage.getItem('wpb-difficulty');
  if (savedDiff) {
    document.querySelectorAll('.diff-btn').forEach(b => {
      const active = b.dataset.diff === savedDiff;
      b.classList.toggle('diff-btn--active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    aiDifficulty = savedDiff;
  }

  // ── Play VS AI ────────────────────────────────────────────
  const btnVsAi = document.getElementById('btn-vs-ai');
  if (btnVsAi) {
    btnVsAi.addEventListener('click', () => {
      if (!trie) return;
      gameMode     = 'vs-ai';
      aiDifficulty = getSelectedDifficulty();
      document.getElementById('p2-label').textContent = 'AI';
      startGame();
    });
  }

  // ── Play VS Friend ────────────────────────────────────────
  const btnVsFriend = document.getElementById('btn-vs-friend');
  if (btnVsFriend) {
    btnVsFriend.addEventListener('click', () => {
      if (!trie) return;
      gameMode = 'vs-human';
      document.getElementById('p2-label').textContent = 'GUEST';
      startGame();
    });
  }

  // ── Settings gear icon in home footer → opens Settings tab ─
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => switchToTab('settings'));
  }

  // ── How to play → replays tutorial ───────────────────────
  const howBtn = document.getElementById('btn-how-to-play');
  if (howBtn) {
    howBtn.addEventListener('click', () => {
      if (window.tutorial) {
        window.tutorial.reset();
        window.tutorial.show();
      }
    });
  }

  // ── Theme toggle (lives in Settings tab) ─────────────────
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    // Sync initial pressed state and label
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    _applyThemeUI(current);

    themeBtn.addEventListener('click', () => {
      const root    = document.documentElement;
      const current = root.getAttribute('data-theme') || 'dark';
      const next    = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('wpb-theme', next);
      _applyThemeUI(next);
    });
  }

  // ── Reset tutorial (Settings tab) ────────────────────────
  const resetTutorialBtn = document.getElementById('btn-reset-tutorial');
  if (resetTutorialBtn) {
    resetTutorialBtn.addEventListener('click', () => {
      if (window.tutorial) {
        window.tutorial.reset();
        // Switch to BATTLE tab so tutorial is visible
        switchToTab('battle');
        window.tutorial.show();
      }
    });
  }

  // ── In-game home button ───────────────────────────────────
  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      if (gameOver || confirm('Leave this game and return to menu?')) goHome();
    });
  }

  // ── Letter picker cancel ──────────────────────────────────
  const cancelBtn = document.getElementById('modal-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('letter-modal').classList.add('hidden');
      pendingCell = null;
    });
  }

  // ── Win modal ─────────────────────────────────────────────
  const playAgainBtn = document.getElementById('play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      document.getElementById('win-modal').classList.add('hidden');
      startGame();
    });
  }

  const winHomeBtn = document.getElementById('win-home');
  if (winHomeBtn) winHomeBtn.addEventListener('click', goHome);
}

/**
 * Syncs theme toggle button state and label text.
 * @param {'dark'|'light'} theme
 */
function _applyThemeUI(theme) {
  const themeBtn   = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  if (themeBtn)   themeBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  if (themeLabel) themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
}

/* ==========================================================
   GAME LIFECYCLE
   ========================================================== */

/** Resets all state and transitions to the game board. */
function startGame() {
  scores      = { p1: 0, p2: 0 };
  currentTurn = 'p1';
  gameOver    = false;
  pendingCell = null;
  scoredPaths = new Set();
  lastWord    = '';
  showScreen('game');
  renderBoard();
  updateHUD();
}

/** Returns to the home screen and cleans up any active overlays. */
function goHome() {
  gameOver = true; // stop AI from firing after navigation
  document.getElementById('win-modal').classList.add('hidden');
  document.getElementById('letter-modal').classList.add('hidden');
  showAIThinking(false);
  showScreen('home');
}

/* ==========================================================
   BOARD
   ========================================================== */

/** Builds the board state array and renders 100 tiles via DocumentFragment. */
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
    for (let c = 0; c < 10; c++) frag.appendChild(createTileEl(r, c));
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
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTileClick.call(el, e); }
  });
  return el;
}

/* ==========================================================
   TILE INTERACTION
   ========================================================== */

/** Tile click / keypress handler. */
function onTileClick() {
  if (gameOver) return;
  if (gameMode === 'vs-ai' && currentTurn === 'p2') return;
  const r = parseInt(this.dataset.r, 10);
  const c = parseInt(this.dataset.c, 10);
  if (board[r][c].letter) return;
  pendingCell = { r, c };
  showLetterModal();
}

/** Opens the bottom-sheet letter picker using a DocumentFragment. */
function showLetterModal() {
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

/** Called when a letter is selected in the picker. */
function onLetterChosen(letter) {
  document.getElementById('letter-modal').classList.add('hidden');
  if (!pendingCell) return;
  placeLetterOnBoard(pendingCell.r, pendingCell.c, letter, currentTurn);
  pendingCell = null;
}

/* ==========================================================
   CORE LOGIC
   ========================================================== */

/**
 * Places a letter, detects words, scores, and advances the turn.
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
      const scoreOwner = (owner === 'ai') ? 'p2' : owner;
      scores[scoreOwner] += pts;
      updateHUD();
      flashCells(cellsToFlash);
      if (checkWin()) return;
    }
  }
  switchTurn();
}

/** Updates a single tile's DOM element without touching any other tile. */
function updateTileEl(r, c) {
  const el = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  if (!el) return;
  const cell = board[r][c];
  el.textContent = cell.letter || '';
  el.className   = `tile tile--filled tile--owner-${cell.owner}`;
  el.setAttribute('tabindex', '-1'); // remove from tab order once filled
  const ownerName = cell.owner === 'p1' ? 'Player 1'
                  : cell.owner === 'ai' ? 'AI'
                  : 'Player 2';
  el.setAttribute('aria-label', `Letter ${cell.letter}, owned by ${ownerName}`);
}

/**
 * Triggers the score-flash animation on a set of cells via rAF.
 * Only animates transform + opacity — never layout properties.
 * @param {Set<string>} cellKeys  — 'row,col' strings
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
 * Scans all 8 directions from the placed cell and returns valid words.
 * Spec §5: walk backward to line start, collect forward, extract all
 * substrings ≥ 3 that include the placed index, validate via trie.
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
    let sr = placedRow, sc = placedCol;
    while (inBounds(sr - dr, sc - dc) && board[sr - dr][sc - dc].letter) {
      sr -= dr; sc -= dc;
    }

    const line = [], coords = [];
    let r = sr, c = sc;
    while (inBounds(r, c) && board[r][c].letter) {
      line.push(board[r][c].letter);
      coords.push([r, c]);
      r += dr; c += dc;
    }

    if (line.length < 3) continue;
    const pi = coords.findIndex(([rr, cc]) => rr === placedRow && cc === placedCol);
    if (pi === -1) continue;

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
 * Points for a word by length. Spec §6.
 * @param {string} word
 * @returns {number}
 */
function scoreWord(word) { return word.length >= 5 ? 3 : word.length === 4 ? 2 : 1; }

/* ==========================================================
   TURN & WIN
   ========================================================== */

/** Advances turn and fires AI if in VS-AI mode. */
function switchTurn() {
  currentTurn = currentTurn === 'p1' ? 'p2' : 'p1';
  updateHUD();
  if (gameMode === 'vs-ai' && currentTurn === 'p2') triggerAI();
}

/**
 * Fires the AI move via setTimeout(0) so it never blocks the paint frame.
 * Spec §8: enforces 180ms budget inside aiSelectMove.
 */
function triggerAI() {
  showAIThinking(true);
  setTimeout(() => {
    if (gameOver) { showAIThinking(false); return; }
    if (typeof aiSelectMove === 'function') {
      aiSelectMove(board, trie, aiDifficulty, move => {
        showAIThinking(false);
        if (!gameOver) placeLetterOnBoard(move.row, move.col, move.letter, 'ai');
      });
    }
  }, 0);
}

/**
 * Checks score threshold and board-full conditions.
 * @returns {boolean} true if game is over
 */
function checkWin() {
  if (scores.p1 >= WIN_SCORE || scores.p2 >= WIN_SCORE) {
    const winner = scores.p1 >= WIN_SCORE ? 'YOU'
                 : (gameMode === 'vs-ai' ? 'AI' : 'GUEST');
    showWin(winner);
    return true;
  }
  let filled = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (board[r][c].letter) filled++;
  if (filled === 100) {
    const w = scores.p1 > scores.p2 ? 'YOU'
            : scores.p2 > scores.p1 ? (gameMode === 'vs-ai' ? 'AI' : 'GUEST')
            : 'NOBODY';
    showWin(w);
    return true;
  }
  return false;
}

/** @param {string} winner */
function showWin(winner) {
  gameOver = true;
  document.getElementById('win-title').textContent     = winner === 'NOBODY' ? "IT'S A TIE" : `${winner} WINS`;
  document.getElementById('win-scores').textContent    = `${scores.p1} – ${scores.p2}`;
  document.getElementById('win-last-word').textContent = lastWord ? `Last word: ${lastWord}` : '';
  document.getElementById('win-modal').classList.remove('hidden');
}

/* ==========================================================
   HUD
   ========================================================== */

/** Syncs all HUD elements to current game state. */
function updateHUD() {
  document.getElementById('p1-score').textContent = scores.p1;
  document.getElementById('p2-score').textContent = scores.p2;

  const p1Pct = Math.min((scores.p1 / WIN_SCORE) * 100, 100);
  const p2Pct = Math.min((scores.p2 / WIN_SCORE) * 100, 100);
  document.getElementById('p1-progress').style.width = `${p1Pct}%`;
  document.getElementById('p2-progress').style.width = `${p2Pct}%`;

  const p1Bar = document.querySelector('#p1-card .progress-bar');
  const p2Bar = document.querySelector('#p2-card .progress-bar');
  if (p1Bar) p1Bar.setAttribute('aria-valuenow', scores.p1);
  if (p2Bar) p2Bar.setAttribute('aria-valuenow', scores.p2);

  const badge = document.getElementById('turn-badge');
  if (gameOver)                   badge.textContent = 'GAME OVER';
  else if (gameMode === 'vs-ai')  badge.textContent = currentTurn === 'p1' ? 'YOUR TURN' : 'AI TURN';
  else                            badge.textContent = currentTurn === 'p1' ? 'P1 TURN'   : 'P2 TURN';
}

/** @param {boolean} show */
function showAIThinking(show) {
  document.getElementById('ai-thinking').classList.toggle('hidden', !show);
}

/* ==========================================================
   BOOT — script is at end of <body>, DOM is ready
   ========================================================== */

initTabBar();
initHomeScreen();
showScreen('home');

buildTrieAsync(t => {
  trie = t;
  console.log('[WPB] Trie ready');
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('menu-body').classList.remove('hidden');

  // Show tutorial on first visit — tutorial.js has already run
  setTimeout(() => {
    if (window.tutorial && window.tutorial.shouldShowTutorial()) {
      window.tutorial.show();
    }
  }, 50);
});
