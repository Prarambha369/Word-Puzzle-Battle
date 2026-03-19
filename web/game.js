/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
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
let wordsFoundThisGame = 0;

const WIN_SCORE = 20;

/* ==========================================================
   SETTINGS — persisted in localStorage
   ========================================================== */

const SETTINGS_KEY = 'wpb-settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveSettings(patch) {
  const s = Object.assign(loadSettings(), patch);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  return s;
}

/* ==========================================================
   THEME — DARK / LIGHT / DEEP FOREST
   ========================================================== */

/**
 * Applies a visual theme to <html data-theme="...">.
 * @param {'dark'|'light'|'deep-forest'} theme
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wpb-visual-theme', theme);
  saveSettings({ visualTheme: theme });
  _syncThemeButtons(theme);
}

/** Syncs both settings tab segmented control buttons. */
function _syncThemeButtons(active) {
  document.querySelectorAll('.theme-btn[data-visual]').forEach(btn => {
    const on = btn.dataset.visual === active;
    btn.classList.toggle('theme-btn--active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/* ==========================================================
   TAB BAR
   ========================================================== */

/**
 * Switches the active tab. Blocked during live gameplay.
 * @param {string} targetTab
 */
function switchToTab(targetTab) {
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen && !gameScreen.classList.contains('hidden')) return;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const on = btn.dataset.tab === targetTab;
    btn.classList.toggle('tab-btn--active', on);
    btn.setAttribute('aria-selected', String(on));
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.tab !== targetTab);
  });

  // Refresh Garden stats whenever that tab is opened
  if (targetTab === 'garden') refreshGardenUI();
}

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
 * Tab bar slides away during gameplay.
 * @param {'home'|'game'} screen
 */
function showScreen(screen) {
  document.getElementById('home-screen').classList.toggle('hidden', screen !== 'home');
  document.getElementById('game-screen').classList.toggle('hidden', screen !== 'game');
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.classList.toggle('tab-bar--hidden', screen === 'game');
}

/* ==========================================================
   PROFILE UI HELPERS
   ========================================================== */

/**
 * Syncs the settings account card, Garden tab, and HUD player label
 * with the current profile. Safe to call at any time.
 */
function refreshProfileUI() {
  const prof = window.profile;

  // Settings account card
  const nameEl   = document.getElementById('settings-profile-name');
  const statusEl = document.getElementById('settings-profile-status');
  if (nameEl)   nameEl.textContent   = prof.exists() ? prof.name : '—';
  if (statusEl) statusEl.textContent = prof.exists() ? 'STATUS: GROWTH ACTIVE' : 'NOT SIGNED IN';

  // Avatar in settings — show initial as text inside the circle
  const avatarEl   = document.getElementById('settings-avatar');
  const avatarIcon = document.getElementById('settings-avatar-icon');
  if (avatarEl && prof.exists()) {
    // Replace SVG leaf with the player's initial
    if (avatarIcon) avatarIcon.remove();
    avatarEl.textContent = prof.initial;
    avatarEl.classList.add('account-avatar--initial');
  } else if (avatarEl) {
    avatarEl.textContent = '?';
  }

  // HUD player 1 label
  const p1LabelEl = document.getElementById('p1-label');
  if (p1LabelEl && prof.exists()) p1LabelEl.textContent = prof.name.substring(0, 8);

  refreshGardenUI();
  window.refreshProfileUI = refreshProfileUI; // keep global ref
}

/** Syncs the Garden tab stat numbers. */
function refreshGardenUI() {
  const prof = window.profile;

  const gardenAvatar = document.getElementById('garden-avatar');
  const gardenName   = document.getElementById('garden-player-name');
  if (gardenAvatar) gardenAvatar.textContent = prof.exists() ? prof.initial : '?';
  if (gardenName)   gardenName.textContent   = prof.exists() ? prof.name    : '—';

  const sp = document.getElementById('stat-games-played');
  const sw = document.getElementById('stat-games-won');
  const sf = document.getElementById('stat-words-found');
  const sr = document.getElementById('stat-win-rate');
  if (sp) sp.textContent = prof.gamesPlayed;
  if (sw) sw.textContent = prof.gamesWon;
  if (sf) sf.textContent = prof.wordsFound;
  if (sr) sr.textContent = prof.winRate;
}

/* ==========================================================
   SETTINGS WIRING
   ========================================================== */

function initSettings() {
  const s = loadSettings();

  // ── Back arrow ──────────────────────────────────────────
  const backBtn = document.getElementById('settings-back');
  if (backBtn) backBtn.addEventListener('click', () => switchToTab('battle'));

  // ── Visual theme segmented ──────────────────────────────
  const savedTheme = s.visualTheme || localStorage.getItem('wpb-visual-theme') || 'dark';
  applyTheme(savedTheme);

  document.querySelectorAll('.theme-btn[data-visual]').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.visual));
  });

  // ── Settings-tab difficulty segmented ───────────────────
  const savedDiff = s.aiDifficulty || localStorage.getItem('wpb-difficulty') || 'medium';
  aiDifficulty = savedDiff;
  document.querySelectorAll('.theme-btn[data-setting-diff]').forEach(btn => {
    const on = btn.dataset.settingDiff === savedDiff;
    btn.classList.toggle('theme-btn--active', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.addEventListener('click', () => {
      aiDifficulty = btn.dataset.settingDiff;
      saveSettings({ aiDifficulty: aiDifficulty });
      localStorage.setItem('wpb-difficulty', aiDifficulty);
      // Also sync home screen difficulty buttons
      document.querySelectorAll('.diff-btn').forEach(b => {
        const a = b.dataset.diff === aiDifficulty;
        b.classList.toggle('diff-btn--active', a);
        b.setAttribute('aria-pressed', String(a));
      });
      document.querySelectorAll('.theme-btn[data-setting-diff]').forEach(b => {
        const a = b.dataset.settingDiff === aiDifficulty;
        b.classList.toggle('theme-btn--active', a);
        b.setAttribute('aria-pressed', String(a));
      });
    });
  });

  // ── Audio toggles ───────────────────────────────────────
  _initAudioToggle('toggle-sfx',   'sfxEnabled',   true);
  _initAudioToggle('toggle-music', 'musicEnabled', false);

  // ── Account: Sign Out ───────────────────────────────────
  const signOutBtn = document.getElementById('btn-sign-out');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      if (confirm('Sign out and reset your profile?')) {
        window.profile.signOut();
        refreshProfileUI();
        // Show profile setup again
        showProfileSetup(name => {
          window.profile.create(name);
          refreshProfileUI();
        });
      }
    });
  }

  // ── Account: Edit Name ──────────────────────────────────
  const editNameBtn = document.getElementById('btn-edit-name');
  if (editNameBtn) {
    editNameBtn.addEventListener('click', () => {
      const modal  = document.getElementById('edit-name-modal');
      const input  = document.getElementById('edit-name-input');
      if (!modal || !input) return;
      input.value = window.profile.name || '';
      modal.classList.remove('hidden');
      input.focus();
      input.select();
    });
  }

  const editConfirm = document.getElementById('edit-name-confirm');
  const editCancel  = document.getElementById('edit-name-cancel');
  const editModal   = document.getElementById('edit-name-modal');
  const editInput   = document.getElementById('edit-name-input');
  const editError   = document.getElementById('edit-name-error');

  function doEditConfirm() {
    const name = editInput ? editInput.value.trim() : '';
    if (!name || name.length < 2) {
      if (editError) editError.classList.remove('hidden');
      return;
    }
    window.profile.create(name);
    refreshProfileUI();
    if (editModal) editModal.classList.add('hidden');
    if (editError) editError.classList.add('hidden');
  }

  if (editConfirm) editConfirm.addEventListener('click', doEditConfirm);
  if (editInput)   editInput.addEventListener('keydown', e => { if (e.key === 'Enter') doEditConfirm(); });
  if (editCancel)  editCancel.addEventListener('click', () => {
    if (editModal) editModal.classList.add('hidden');
  });
}

/**
 * Sets up one audio toggle button.
 * @param {string}  btnId
 * @param {string}  settingKey
 * @param {boolean} defaultOn
 */
function _initAudioToggle(btnId, settingKey, defaultOn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const s = loadSettings();
  const on = settingKey in s ? s[settingKey] : defaultOn;
  _setToggle(btn, on);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    _setToggle(btn, next);
    saveSettings({ [settingKey]: next });
  });
}

/** @param {HTMLElement} btn @param {boolean} on */
function _setToggle(btn, on) {
  btn.setAttribute('aria-checked', String(on));
  btn.classList.toggle('toggle-btn--on', on);
}

/* ==========================================================
   HOME SCREEN BUTTONS
   ========================================================== */

function getSelectedDifficulty() {
  const a = document.querySelector('.diff-btn--active');
  return a ? a.dataset.diff : aiDifficulty;
}

function initHomeScreen() {

  // ── Difficulty (home screen) ─────────────────────────────
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.remove('diff-btn--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('diff-btn--active');
      btn.setAttribute('aria-pressed', 'true');
      aiDifficulty = btn.dataset.diff;
      saveSettings({ aiDifficulty: btn.dataset.diff });
      localStorage.setItem('wpb-difficulty', btn.dataset.diff);
      // Sync settings tab difficulty too
      document.querySelectorAll('.theme-btn[data-setting-diff]').forEach(b => {
        const a = b.dataset.settingDiff === aiDifficulty;
        b.classList.toggle('theme-btn--active', a);
        b.setAttribute('aria-pressed', String(a));
      });
    });
  });

  // Restore saved difficulty on home screen
  const savedDiff = loadSettings().aiDifficulty || localStorage.getItem('wpb-difficulty') || 'medium';
  aiDifficulty = savedDiff;
  document.querySelectorAll('.diff-btn').forEach(b => {
    const on = b.dataset.diff === savedDiff;
    b.classList.toggle('diff-btn--active', on);
    b.setAttribute('aria-pressed', String(on));
  });

  // ── Play VS AI ──────────────────────────────────────────
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

  // ── Play VS Friend ───────────────────────────────────────
  const btnVsFriend = document.getElementById('btn-vs-friend');
  if (btnVsFriend) {
    btnVsFriend.addEventListener('click', () => {
      if (!trie) return;
      gameMode = 'vs-human';
      document.getElementById('p2-label').textContent = 'GUEST';
      startGame();
    });
  }

  // ── Settings gear icon ──────────────────────────────────
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', () => switchToTab('settings'));

  // ── How to play ─────────────────────────────────────────
  const howBtn = document.getElementById('btn-how-to-play');
  if (howBtn) {
    howBtn.addEventListener('click', () => {
      if (window.tutorial) { window.tutorial.reset(); window.tutorial.show(); }
    });
  }

  // ── In-game home button ─────────────────────────────────
  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      if (gameOver || confirm('Leave this game and return to menu?')) goHome();
    });
  }

  // ── Letter picker cancel ────────────────────────────────
  const cancelBtn = document.getElementById('modal-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      document.getElementById('letter-modal').classList.add('hidden');
      pendingCell = null;
    });
  }

  // ── Win modal buttons ───────────────────────────────────
  const playAgainBtn = document.getElementById('play-again');
  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
      document.getElementById('win-modal').classList.add('hidden');
      startGame();
    });
  }

  const winHomeBtn = document.getElementById('win-home');
  if (winHomeBtn) winHomeBtn.addEventListener('click', goHome);

  const winCloseBtn = document.getElementById('win-close');
  if (winCloseBtn) winCloseBtn.addEventListener('click', goHome);

  const viewStatsBtn = document.getElementById('btn-view-stats');
  if (viewStatsBtn) {
    viewStatsBtn.addEventListener('click', () => {
      document.getElementById('win-modal').classList.add('hidden');
      switchToTab('garden');
      showScreen('home');
    });
  }
}

/* ==========================================================
   GAME LIFECYCLE
   ========================================================== */

function startGame() {
  scores               = { p1: 0, p2: 0 };
  currentTurn          = 'p1';
  gameOver             = false;
  pendingCell          = null;
  scoredPaths          = new Set();
  lastWord             = '';
  wordsFoundThisGame   = 0;
  showScreen('game');
  renderBoard();
  updateHUD();
}

function goHome() {
  gameOver = true;
  document.getElementById('win-modal').classList.add('hidden');
  document.getElementById('letter-modal').classList.add('hidden');
  showAIThinking(false);
  showScreen('home');
}

/* ==========================================================
   BOARD
   ========================================================== */

function renderBoard() {
  board = [];
  for (let r = 0; r < 10; r++) {
    board[r] = [];
    for (let c = 0; c < 10; c++)
      board[r][c] = { letter: null, owner: null, row: r, col: c };
  }
  const grid = document.getElementById('board');
  const frag = document.createDocumentFragment();
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) frag.appendChild(createTileEl(r, c));
  grid.innerHTML = '';
  grid.appendChild(frag);
}

/** @returns {HTMLElement} */
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

function onTileClick() {
  if (gameOver) return;
  if (gameMode === 'vs-ai' && currentTurn === 'p2') return;
  const r = parseInt(this.dataset.r, 10);
  const c = parseInt(this.dataset.c, 10);
  if (board[r][c].letter) return;
  pendingCell = { r, c };
  showLetterModal();
}

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

function onLetterChosen(letter) {
  document.getElementById('letter-modal').classList.add('hidden');
  if (!pendingCell) return;
  placeLetterOnBoard(pendingCell.r, pendingCell.c, letter, currentTurn);
  pendingCell = null;
}

/* ==========================================================
   CORE LOGIC
   ========================================================== */

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
        wordsFoundThisGame++;
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

function updateTileEl(r, c) {
  const el = document.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  if (!el) return;
  const cell = board[r][c];
  el.textContent = cell.letter || '';
  el.className   = `tile tile--filled tile--owner-${cell.owner}`;
  el.setAttribute('tabindex', '-1');
  const ownerName = cell.owner === 'p1' ? 'Player 1' : cell.owner === 'ai' ? 'AI' : 'Player 2';
  el.setAttribute('aria-label', `Letter ${cell.letter}, owned by ${ownerName}`);
}

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

function detectWords(board, placedRow, placedCol, trie) {
  const DIRS = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  const found = [];
  const seen  = new Set();

  for (const [dr, dc] of DIRS) {
    let sr = placedRow, sc = placedCol;
    while (inBounds(sr - dr, sc - dc) && board[sr - dr][sc - dc].letter) { sr -= dr; sc -= dc; }
    const line = [], coords = [];
    let r = sr, c = sc;
    while (inBounds(r, c) && board[r][c].letter) {
      line.push(board[r][c].letter); coords.push([r, c]); r += dr; c += dc;
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

function inBounds(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 10; }
function scoreWord(word) { return word.length >= 5 ? 3 : word.length === 4 ? 2 : 1; }

/* ==========================================================
   TURN & WIN
   ========================================================== */

function switchTurn() {
  currentTurn = currentTurn === 'p1' ? 'p2' : 'p1';
  updateHUD();
  if (gameMode === 'vs-ai' && currentTurn === 'p2') triggerAI();
}

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

function checkWin() {
  if (scores.p1 >= WIN_SCORE || scores.p2 >= WIN_SCORE) {
    const p1Won = scores.p1 >= scores.p2;
    showWin(p1Won);
    return true;
  }
  let filled = 0;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (board[r][c].letter) filled++;
  if (filled === 100) {
    showWin(scores.p1 >= scores.p2);
    return true;
  }
  return false;
}

/**
 * Shows the victory modal with champion / loser cards matching Image 3.
 * @param {boolean} p1Won
 */
function showWin(p1Won) {
  gameOver = true;

  const prof = window.profile;
  const playerName = prof.exists() ? prof.name : 'YOU';
  const p2Name = gameMode === 'vs-ai' ? 'AI' : 'GUEST';

  const winnerName = p1Won ? playerName : p2Name;
  const loserName  = p1Won ? p2Name     : playerName;
  const winnerPts  = p1Won ? scores.p1  : scores.p2;
  const loserPts   = p1Won ? scores.p2  : scores.p1;

  document.getElementById('win-pill').textContent    = p1Won ? 'YOU WIN' : 'YOU LOSE';
  document.getElementById('win-pill').className      = `win-pill ${p1Won ? '' : 'win-pill--lose'}`;
  document.getElementById('winner-name').textContent = winnerName;
  document.getElementById('winner-pts').textContent  = `${winnerPts} pts`;
  document.getElementById('loser-name').textContent  = loserName;
  document.getElementById('loser-pts').textContent   = `${loserPts} pts`;

  // Avatars — initial letter
  const winnerInitial = winnerName[0].toUpperCase();
  const loserInitial  = loserName[0].toUpperCase();
  document.getElementById('winner-avatar').textContent = winnerInitial;
  document.getElementById('loser-avatar').textContent  = loserInitial;

  // Last word card
  const lastWordEl = document.getElementById('win-last-word');
  const bonusEl    = document.getElementById('win-bonus');
  if (lastWordEl) lastWordEl.textContent = lastWord || '—';
  if (bonusEl)    bonusEl.textContent    = lastWord && scoreWord(lastWord) >= 3 ? '+3 bonus points applied' : '';

  // Record game in profile
  if (prof.exists()) {
    prof.recordGame({ won: p1Won, wordsFound: wordsFoundThisGame, points: scores.p1 });
    refreshGardenUI();
  }

  document.getElementById('win-modal').classList.remove('hidden');
}

/* ==========================================================
   HUD
   ========================================================== */

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
  if (gameOver)                    badge.textContent = 'GAME OVER';
  else if (gameMode === 'vs-ai')   badge.textContent = currentTurn === 'p1' ? 'YOUR TURN' : 'AI TURN';
  else                             badge.textContent = currentTurn === 'p1' ? 'P1 TURN'   : 'P2 TURN';
}

function showAIThinking(show) {
  document.getElementById('ai-thinking').classList.toggle('hidden', !show);
}

/* ==========================================================
   BOOT
   ========================================================== */

initTabBar();
initSettings();
initHomeScreen();
showScreen('home');

// expose refreshProfileUI globally for profile.js
window.refreshProfileUI = refreshProfileUI;

buildTrieAsync(t => {
  trie = t;
  console.log('[WPB] Trie ready');
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('menu-body').classList.remove('hidden');

  // Profile gate — show name prompt on first visit
  const prof = window.profile;
  if (!prof.exists()) {
    setTimeout(() => {
      showProfileSetup(name => {
        prof.create(name);
        refreshProfileUI();
        // After profile, show tutorial
        if (window.tutorial && window.tutorial.shouldShowTutorial()) window.tutorial.show();
      });
    }, 300);
  } else {
    refreshProfileUI();
    // Sync HUD label immediately
    const p1LabelEl = document.getElementById('p1-label');
    if (p1LabelEl) p1LabelEl.textContent = prof.name.substring(0, 8);
    setTimeout(() => {
      if (window.tutorial && window.tutorial.shouldShowTutorial()) window.tutorial.show();
    }, 100);
  }
});
