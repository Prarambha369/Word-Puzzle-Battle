/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/Word-Puzzle-Battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

/* ==========================================================
   STATE
   ========================================================== */
let _currentTurn       = 'p1';
let board              = [];
let scores             = { p1: 0, p2: 0 };
let trie               = null;
let gameOver           = false;
let pendingCell        = null;
let scoredPaths        = new Set();
let gameMode           = 'vs-ai';
let aiDifficulty       = 'medium';
let lastWord           = '';
let wordsFoundThisGame = 0;

const WIN_SCORE = 20;

/*
 * Expose currentTurn as a window property so firebase-multiplayer.js
 * can set it with window.currentTurn = 'p1' and the change is
 * immediately visible to onTileClick() and switchTurn() which read
 * the local variable via the getter below.
 */
Object.defineProperty(window, 'currentTurn', {
  get() { return _currentTurn; },
  set(v) { _currentTurn = v; }
});

// Alias for internal use throughout this file
function getCurrentTurn()    { return _currentTurn; }
function setCurrentTurn(val) { _currentTurn = val; }

/* ==========================================================
   SETTINGS — persisted in localStorage
   ========================================================== */
const SETTINGS_KEY = 'wpb-settings';

function loadSettings() {
  try { const r = localStorage.getItem(SETTINGS_KEY); return r ? JSON.parse(r) : {}; }
  catch (e) { return {}; }
}
function saveSettings(patch) {
  const s = Object.assign(loadSettings(), patch);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  return s;
}

/* ==========================================================
   THEME
   ========================================================== */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('wpb-visual-theme', theme);
  saveSettings({ visualTheme: theme });
  document.querySelectorAll('.theme-btn[data-visual]').forEach(btn => {
    const on = btn.dataset.visual === theme;
    btn.classList.toggle('theme-btn--active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

/* ==========================================================
   TAB BAR
   ========================================================== */
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
  if (targetTab === 'garden') refreshAllProfileUI();
}

function initTabBar() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchToTab(btn.dataset.tab);
      if (btn.dataset.tab === 'lobby') {
        const panel = document.querySelector('[data-tab="lobby"]');
        if (panel && !panel.dataset.fbReady && typeof renderFBLobbyScreen === 'function') {
          renderFBLobbyScreen();
          panel.dataset.fbReady = 'true';
        }
      }
    });
  });
}

/* ==========================================================
   SCREENS
   ========================================================== */
function showScreen(screen) {
  document.getElementById('home-screen').classList.toggle('hidden', screen !== 'home');
  document.getElementById('game-screen').classList.toggle('hidden', screen !== 'game');
  const tabBar = document.getElementById('tab-bar');
  if (tabBar) tabBar.classList.toggle('tab-bar--hidden', screen === 'game');
}

/* ==========================================================
   PROFILE UI
   ========================================================== */
function refreshAllProfileUI() {
  const auth = window.auth;
  const prof = auth?.isSignedIn ? auth : window.profile;

  const nameEl   = document.getElementById('settings-profile-name');
  const statusEl = document.getElementById('settings-profile-status');
  const avatarEl = document.getElementById('settings-avatar');

  if (nameEl)   nameEl.textContent   = prof?.name || '—';
  if (statusEl) statusEl.textContent = auth?.isSignedIn
    ? 'STATUS: GROWTH ACTIVE'
    : (window.profile?.exists() ? 'STATUS: GUEST MODE' : 'NOT SIGNED IN');

  if (avatarEl) {
    if (auth?.isSignedIn && auth.photoURL) {
      avatarEl.innerHTML = `<img src="${auth.photoURL}" alt="${auth.name}" class="account-avatar-img" />`;
    } else {
      avatarEl.textContent = prof?.initial || '?';
      avatarEl.classList.add('account-avatar--initial');
    }
  }

  const p1Label = document.getElementById('p1-label');
  if (p1Label) p1Label.textContent = (prof?.name || 'YOU').substring(0, 8);

  const gardenAvatar = document.getElementById('garden-avatar');
  const gardenName   = document.getElementById('garden-player-name');
  const gardenStatus = document.getElementById('garden-status');
  if (gardenName)   gardenName.textContent   = prof?.name || '—';
  if (gardenStatus) gardenStatus.textContent = auth?.isSignedIn
    ? '☁ SYNCED TO CLOUD' : '💾 LOCAL STORAGE';
  if (gardenAvatar) {
    if (auth?.isSignedIn && auth.photoURL) {
      gardenAvatar.innerHTML = `<img src="${auth.photoURL}" alt="${auth.name}" class="garden-avatar-img" />`;
    } else {
      gardenAvatar.textContent = prof?.initial || '?';
    }
  }

  const sp = document.getElementById('stat-games-played');
  const sw = document.getElementById('stat-games-won');
  const sf = document.getElementById('stat-words-found');
  const sr = document.getElementById('stat-win-rate');
  if (sp) sp.textContent = prof?.gamesPlayed || 0;
  if (sw) sw.textContent = prof?.gamesWon    || 0;
  if (sf) sf.textContent = prof?.wordsFound  || 0;
  if (sr) sr.textContent = prof?.winRate     || '—';

  const signOutBtn = document.getElementById('btn-sign-out');
  if (signOutBtn) signOutBtn.textContent = auth?.isSignedIn ? 'SIGN OUT' : 'SIGNED IN AS GUEST';
}
window.refreshAllProfileUI = refreshAllProfileUI;

/* ==========================================================
   SETTINGS WIRING
   ========================================================== */
function initSettings() {
  const s = loadSettings();

  document.getElementById('settings-back')?.addEventListener('click', () => switchToTab('battle'));

  const savedTheme = s.visualTheme || localStorage.getItem('wpb-visual-theme') || 'dark';
  applyTheme(savedTheme);
  document.querySelectorAll('.theme-btn[data-visual]').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.visual));
  });

  const savedDiff = s.aiDifficulty || localStorage.getItem('wpb-difficulty') || 'medium';
  aiDifficulty = savedDiff;
  document.querySelectorAll('.theme-btn[data-setting-diff]').forEach(btn => {
    const on = btn.dataset.settingDiff === savedDiff;
    btn.classList.toggle('theme-btn--active', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.addEventListener('click', () => {
      aiDifficulty = btn.dataset.settingDiff;
      saveSettings({ aiDifficulty });
      localStorage.setItem('wpb-difficulty', aiDifficulty);
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

  _initAudioToggle('toggle-sfx',   'sfxEnabled',   true);
  _initAudioToggle('toggle-music', 'musicEnabled', false);

  document.getElementById('btn-sign-out')?.addEventListener('click', () => {
    if (typeof handleSignOut === 'function') {
      handleSignOut();
    } else if (confirm('Sign out and reset your profile?')) {
      window.profile?.signOut();
      refreshAllProfileUI();
    }
  });

  document.getElementById('btn-edit-name')?.addEventListener('click', () => {
    const modal = document.getElementById('edit-name-modal');
    const input = document.getElementById('edit-name-input');
    if (!modal || !input) return;
    input.value = (window.auth?.isSignedIn ? window.auth.name : window.profile?.name) || '';
    modal.classList.remove('hidden');
    input.focus(); input.select();
  });

  function doEditConfirm() {
    const input = document.getElementById('edit-name-input');
    const err   = document.getElementById('edit-name-error');
    const name  = input?.value.trim();
    if (!name || name.length < 2) { err?.classList.remove('hidden'); return; }
    window.profile?.create(name);
    refreshAllProfileUI();
    document.getElementById('edit-name-modal')?.classList.add('hidden');
    err?.classList.add('hidden');
  }
  document.getElementById('edit-name-confirm')?.addEventListener('click', doEditConfirm);
  document.getElementById('edit-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doEditConfirm();
  });
  document.getElementById('edit-name-cancel')?.addEventListener('click', () => {
    document.getElementById('edit-name-modal')?.classList.add('hidden');
  });

  document.getElementById('btn-reset-tutorial')?.addEventListener('click', () => {
    if (window.tutorial) {
      window.tutorial.reset();
      switchToTab('battle');
      window.tutorial.show();
    }
  });
}

function _initAudioToggle(btnId, settingKey, defaultOn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const s  = loadSettings();
  const on = settingKey in s ? s[settingKey] : defaultOn;
  _setToggle(btn, on);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    _setToggle(btn, next);
    saveSettings({ [settingKey]: next });
  });
}
function _setToggle(btn, on) {
  btn.setAttribute('aria-checked', String(on));
  btn.classList.toggle('toggle-btn--on', on);
}

/* ==========================================================
   HOME SCREEN BUTTONS
   ========================================================== */
function getSelectedDifficulty() {
  return document.querySelector('.diff-btn--active')?.dataset.diff || aiDifficulty;
}

function initHomeScreen() {
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.remove('diff-btn--active'); b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('diff-btn--active'); btn.setAttribute('aria-pressed', 'true');
      aiDifficulty = btn.dataset.diff;
      saveSettings({ aiDifficulty });
      localStorage.setItem('wpb-difficulty', btn.dataset.diff);
      document.querySelectorAll('.theme-btn[data-setting-diff]').forEach(b => {
        const a = b.dataset.settingDiff === aiDifficulty;
        b.classList.toggle('theme-btn--active', a); b.setAttribute('aria-pressed', String(a));
      });
    });
  });

  const savedDiff = loadSettings().aiDifficulty || localStorage.getItem('wpb-difficulty') || 'medium';
  aiDifficulty = savedDiff;
  document.querySelectorAll('.diff-btn').forEach(b => {
    const on = b.dataset.diff === savedDiff;
    b.classList.toggle('diff-btn--active', on); b.setAttribute('aria-pressed', String(on));
  });

  document.getElementById('btn-vs-ai')?.addEventListener('click', () => {
    if (!trie) return;
    gameMode     = 'vs-ai';
    aiDifficulty = getSelectedDifficulty();
    document.getElementById('p2-label').textContent = 'AI';
    startGame();
  });

  document.getElementById('btn-vs-friend')?.addEventListener('click', () => {
    switchToTab('lobby');
    const panel = document.querySelector('[data-tab="lobby"]');
    if (panel && !panel.dataset.fbReady && typeof renderFBLobbyScreen === 'function') {
      renderFBLobbyScreen();
      panel.dataset.fbReady = 'true';
    }
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => switchToTab('settings'));

  document.getElementById('btn-how-to-play')?.addEventListener('click', () => {
    if (window.tutorial) { window.tutorial.reset(); window.tutorial.show(); }
  });

  document.getElementById('btn-home')?.addEventListener('click', () => {
    if (gameOver || confirm('Leave this game and return to menu?')) goHome();
  });

  document.getElementById('modal-cancel')?.addEventListener('click', () => {
    document.getElementById('letter-modal').classList.add('hidden');
    pendingCell = null;
  });

  document.getElementById('play-again')?.addEventListener('click', () => {
    document.getElementById('win-modal').classList.add('hidden');
    startGame();
  });
  document.getElementById('win-home')?.addEventListener('click', goHome);
  document.getElementById('win-close')?.addEventListener('click', goHome);
  document.getElementById('btn-view-stats')?.addEventListener('click', () => {
    document.getElementById('win-modal').classList.add('hidden');
    switchToTab('garden');
    showScreen('home');
  });
}

/* ==========================================================
   GAME LIFECYCLE
   ========================================================== */
function startGame() {
  scores             = { p1: 0, p2: 0 };
  setCurrentTurn('p1');
  gameOver           = false;
  pendingCell        = null;
  scoredPaths        = new Set();
  lastWord           = '';
  wordsFoundThisGame = 0;
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
    for (let c = 0; c < 10; c++)
      frag.appendChild(createTileEl(r, c));
  grid.innerHTML = '';
  grid.appendChild(frag);
}

function createTileEl(r, c) {
  const el = document.createElement('div');
  el.className = 'tile';
  el.dataset.r = r; el.dataset.c = c;
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

  // Block taps when it's not the local player's turn
  if (gameMode === 'vs-ai'      && getCurrentTurn() === 'p2') return;
  if (gameMode === 'vs-firebase' && getCurrentTurn() === 'p2') return;

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

  if (gameMode === 'vs-firebase' && typeof fbOnTileChosen === 'function') {
    fbOnTileChosen(pendingCell.r, pendingCell.c, letter);
    pendingCell = null;
    return;
  }

  placeLetterOnBoard(pendingCell.r, pendingCell.c, letter, getCurrentTurn());
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
      const so = (owner === 'ai') ? 'p2' : owner;
      scores[so] += pts;
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
window.flashCells = flashCells;

/* ==========================================================
   WORD DETECTION
   ========================================================== */
function detectWords(board, placedRow, placedCol, trie) {
  const DIRS  = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  const found = [], seen = new Set();
  for (const [dr, dc] of DIRS) {
    let sr = placedRow, sc = placedCol;
    while (inBounds(sr-dr, sc-dc) && board[sr-dr][sc-dc].letter) { sr -= dr; sc -= dc; }
    const line = [], coords = [];
    let r = sr, c = sc;
    while (inBounds(r, c) && board[r][c].letter) {
      line.push(board[r][c].letter); coords.push([r, c]); r += dr; c += dc;
    }
    if (line.length < 3) continue;
    const pi = coords.findIndex(([rr, cc]) => rr === placedRow && cc === placedCol);
    if (pi === -1) continue;
    for (let s = 0; s <= pi; s++) for (let e = pi + 1; e <= line.length; e++) {
      if (e - s < 3) continue;
      const word  = line.slice(s, e).join('');
      const cells = coords.slice(s, e);
      const key   = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');
      if (seen.has(key)) continue; seen.add(key);
      if (trie.search(word)) found.push({ word, cells });
    }
  }
  return found;
}
window.detectWords = detectWords;

function inBounds(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 10; }
function scoreWord(word) { return word.length >= 5 ? 3 : word.length === 4 ? 2 : 1; }
window.scoreWord = scoreWord;

/* ==========================================================
   TURN & WIN
   ========================================================== */
function switchTurn() {
  setCurrentTurn(getCurrentTurn() === 'p1' ? 'p2' : 'p1');
  updateHUD();
  if (gameMode === 'vs-ai' && getCurrentTurn() === 'p2') triggerAI();
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
    showWin(scores.p1 >= scores.p2);
    return true;
  }
  let filled = 0;
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (board[r][c].letter) filled++;
  if (filled === 100) { showWin(scores.p1 >= scores.p2); return true; }
  return false;
}

function showWin(p1Won) {
  gameOver = true;

  const auth = window.auth;
  const prof = auth?.isSignedIn ? auth : window.profile;
  const myName = prof?.name || 'YOU';
  const p2Name = gameMode === 'vs-ai' ? 'AI' : (gameMode === 'vs-firebase'
    ? (document.getElementById('p2-label')?.textContent || 'GUEST')
    : 'GUEST');

  const winnerName = p1Won ? myName  : p2Name;
  const loserName  = p1Won ? p2Name  : myName;
  const winnerPts  = p1Won ? scores.p1 : scores.p2;
  const loserPts   = p1Won ? scores.p2 : scores.p1;

  document.getElementById('win-pill').textContent = p1Won ? 'YOU WIN' : 'YOU LOSE';
  document.getElementById('win-pill').className   = `win-pill${p1Won ? '' : ' win-pill--lose'}`;
  document.getElementById('winner-name').textContent = winnerName;
  document.getElementById('winner-pts').textContent  = `${winnerPts} pts`;
  document.getElementById('loser-name').textContent  = loserName;
  document.getElementById('loser-pts').textContent   = `${loserPts} pts`;
  document.getElementById('winner-avatar').textContent = winnerName[0]?.toUpperCase() || '?';
  document.getElementById('loser-avatar').textContent  = loserName[0]?.toUpperCase()  || '?';

  if (p1Won && auth?.isSignedIn && auth.photoURL) {
    document.getElementById('winner-avatar').innerHTML =
      `<img src="${auth.photoURL}" alt="${myName}" class="account-avatar-img" />`;
  }

  const lastWordEl = document.getElementById('win-last-word');
  const bonusEl    = document.getElementById('win-bonus');
  if (lastWordEl) lastWordEl.textContent = lastWord || '—';
  if (bonusEl)    bonusEl.textContent    =
    (lastWord && scoreWord(lastWord) >= 3) ? '+3 bonus points applied' : '';

  if (typeof recordGameResult === 'function') {
    recordGameResult({ won: p1Won, wordsFound: wordsFoundThisGame, points: scores.p1 });
  } else if (prof?.exists?.()) {
    prof.recordGame?.({ won: p1Won, wordsFound: wordsFoundThisGame, points: scores.p1 });
    refreshAllProfileUI();
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

  document.querySelector('#p1-card .progress-bar')?.setAttribute('aria-valuenow', scores.p1);
  document.querySelector('#p2-card .progress-bar')?.setAttribute('aria-valuenow', scores.p2);

  const badge = document.getElementById('turn-badge');
  if (!badge) return;
  if (gameOver) {
    badge.textContent = 'GAME OVER';
  } else if (gameMode === 'vs-ai') {
    badge.textContent = getCurrentTurn() === 'p1' ? 'YOUR TURN' : 'AI TURN';
  } else if (gameMode === 'vs-firebase') {
    badge.textContent = getCurrentTurn() === 'p1' ? 'YOUR TURN' : 'OPPONENT TURN';
  } else {
    badge.textContent = getCurrentTurn() === 'p1' ? 'P1 TURN' : 'P2 TURN';
  }
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

window.refreshAllProfileUI = refreshAllProfileUI;

buildTrieAsync(t => {
  trie = t;
  window.trie = t;   // expose globally for firebase-multiplayer.js word scoring
  console.log('[WPB] Trie ready');
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('menu-body').classList.remove('hidden');

  if (!window.auth?.isSignedIn) {
    if (window.profile && !window.profile.exists()) {
      if (typeof window.auth === 'undefined') {
        setTimeout(() => {
          if (typeof showProfileSetup === 'function') {
            showProfileSetup(name => {
              window.profile.create(name);
              refreshAllProfileUI();
              if (window.tutorial?.shouldShowTutorial()) window.tutorial.show();
            });
          }
        }, 300);
      }
    } else {
      refreshAllProfileUI();
      setTimeout(() => {
        if (window.tutorial?.shouldShowTutorial()) window.tutorial.show();
      }, 100);
    }
  } else {
    refreshAllProfileUI();
  }
});
