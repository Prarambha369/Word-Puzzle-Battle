/**
 * Word Puzzle Battle — Firebase Multiplayer (No Server Required)
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 *
 * ─── SETUP (5 minutes, completely free) ────────────────────
 *   1. Go to console.firebase.google.com
 *   2. Create project → "word-puzzle-battle"
 *   3. Build → Realtime Database → Create database → Start in TEST MODE
 *   4. Project Settings → Your apps → Add web app → Copy firebaseConfig
 *   5. Paste your firebaseConfig into WPB_FIREBASE_CONFIG below
 *   6. That's it. No server. No deployment. Free forever.
 *
 * ─── FIREBASE FREE TIER LIMITS ─────────────────────────────
 *   Simultaneous connections : 100       (enough for ~50 games)
 *   Storage                  : 1 GB      (you'll use ~1 MB)
 *   Bandwidth/month          : 10 GB     (you'll use ~10 MB)
 *   Cost                     : $0 forever on Spark plan
 *
 * ─── SECURITY RULES (paste into Firebase Console) ──────────
 *   {
 *     "rules": {
 *       "rooms": {
 *         "$roomId": {
 *           ".read":  true,
 *           ".write": true,
 *           "board":  { ".validate": "newData.isString()" }
 *         }
 *       }
 *     }
 *   }
 */
'use strict';

/* ==========================================================
   FIREBASE CONFIG
   Loaded from web/config.js (gitignored) via window.WPB_CONFIG.
   Never hardcode credentials here.
   See config.example.js for the template.
   ========================================================== */
function _getFirebaseConfig() {
  const cfg = window.WPB_CONFIG?.firebase;
  if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith('YOUR_')) {
    console.error(
      '[WPB:FB] Firebase config missing.\n' +
      '  1. Copy web/config.example.js → web/config.js\n' +
      '  2. Fill in your Firebase project values.\n' +
      '  3. config.js is gitignored — safe to use.'
    );
    return null;
  }
  return cfg;
}

/* ==========================================================
   TREE-NAME ROOM CODES  (e.g. OAK-77)
   ========================================================== */
const TREE_NAMES = [
  'OAK','ELM','ASH','YEW','FIR','GUM','BAY',
  'IVY','KOA','BOX','TAK','WAX','ZIT','ULU'
];

function generateRoomCode() {
  const tree = TREE_NAMES[Math.floor(Math.random() * TREE_NAMES.length)];
  const num  = String(Math.floor(Math.random() * 90) + 10);
  return `${tree}-${num}`;
}

/* ==========================================================
   FIREBASE MANAGER
   ========================================================== */
class FirebaseMultiplayer {
  constructor() {
    this.db          = null;   // Firebase database instance
    this.roomRef     = null;   // Reference to current room node
    this.roomCode    = null;
    this.playerIndex = 0;      // 0 = host (P1), 1 = guest (P2)
    this.myName      = 'AGENT';
    this.opponentName= 'GUEST';
    this._unsubscribe = null;  // cleanup function for listener
    this._initialized = false;
  }

  /* ── Init Firebase SDK (loaded via CDN) ─────────────────── */
  init() {
    if (this._initialized) return true;
    if (typeof firebase === 'undefined') {
      console.error('[WPB:FB] Firebase SDK not loaded. Add CDN scripts to index.html');
      return false;
    }
    try {
      const cfg = _getFirebaseConfig();
      if (!cfg) return false;
      // Initialise only once
      if (!firebase.apps?.length) {
        firebase.initializeApp(cfg);
      }
      this.db = firebase.database();
      this._initialized = true;
      console.log('[WPB:FB] Firebase connected');
      return true;
    } catch (e) {
      console.error('[WPB:FB] Init failed:', e.message);
      return false;
    }
  }

  /* ── Create room (host flow) ─────────────────────────────── */
  async createRoom(playerName) {
    if (!this.init()) return null;
    this.myName      = playerName.toUpperCase().substring(0, 16);
    this.playerIndex = 0;

    // Generate a unique code — retry if collision
    let code;
    for (let i = 0; i < 10; i++) {
      code = generateRoomCode();
      const snap = await this.db.ref(`rooms/${code}`).once('value');
      if (!snap.exists()) break;
    }

    this.roomCode = code;
    this.roomRef  = this.db.ref(`rooms/${code}`);

    // Write initial room state
    await this.roomRef.set({
      host:        this.myName,
      guest:       null,
      status:      'waiting',            // waiting | playing | finished
      turn:        0,                    // 0 = host moves, 1 = guest moves
      scores:      { host: 0, guest: 0 },
      board:       _serializeBoard(_emptyBoard()),
      lastMove:    null,
      lastWord:    '',
      createdAt:   firebase.database.ServerValue.TIMESTAMP,
      updatedAt:   firebase.database.ServerValue.TIMESTAMP
    });

    // Auto-delete room after 40 minutes
    setTimeout(() => this.roomRef?.remove(), 40 * 60 * 1000);

    console.log(`[WPB:FB] Room created: ${code}`);
    this._listenForGuest();
    return code;
  }

  /* ── Join room (guest flow) ──────────────────────────────── */
  async joinRoom(code, playerName) {
    if (!this.init()) return false;
    this.myName      = playerName.toUpperCase().substring(0, 16);
    this.playerIndex = 1;
    this.roomCode    = code.toUpperCase().trim();
    this.roomRef     = this.db.ref(`rooms/${this.roomCode}`);

    const snap = await this.roomRef.once('value');
    if (!snap.exists()) {
      showFBError('Room not found. Check the code and try again.');
      return false;
    }
    const room = snap.val();
    if (room.status !== 'waiting') {
      showFBError('This room is full or the game has started.');
      return false;
    }

    // Join the room
    await this.roomRef.update({
      guest:    this.myName,
      status:   'playing',
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    this.opponentName = room.host;
    console.log(`[WPB:FB] Joined room ${this.roomCode}`);
    this._listenForGameState();

    // Show match-ready screen immediately
    showMatchReadyScreen(this.myName, this.opponentName, () => {
      startFBMultiplayerGame(
        _deserializeBoard(snap.val().board),
        this.myName,
        this.opponentName,
        this.playerIndex,
        0   // host always moves first
      );
    });
    return true;
  }

  /* ── Listen for guest joining (host only) ───────────────── */
  _listenForGuest() {
    const guestRef = this.roomRef.child('guest');
    const off = guestRef.on('value', snap => {
      if (!snap.val()) return; // still waiting
      guestRef.off('value', off);
      this.opponentName = snap.val();

      // Show match-ready screen for host
      this.roomRef.once('value').then(roomSnap => {
        const room = roomSnap.val();
        showMatchReadyScreen(this.myName, this.opponentName, () => {
          startFBMultiplayerGame(
            _deserializeBoard(room.board),
            this.myName,
            this.opponentName,
            this.playerIndex,
            0
          );
          this._listenForGameState();
        });
      });
    });
  }

  /* ── Listen for game state changes (both players) ────────── */
  _listenForGameState() {
    if (this._unsubscribe) this._unsubscribe();

    const handler = this.roomRef.on('value', snap => {
      if (!snap.exists()) return;
      const room = snap.val();

      // Someone placed a letter — apply to our board
      if (room.lastMove) {
        const move = room.lastMove;
        // Ignore our own moves (we applied them optimistically)
        const isMine = (this.playerIndex === 0 && move.by === 'host') ||
                       (this.playerIndex === 1 && move.by === 'guest');
        if (!isMine) {
          applyFBMove(move, room.scores, room.turn);
        }
      }

      // Game over
      if (room.status === 'finished' && room.winner) {
        showFBWin(room.winner, room.scores, room.lastWord, this.playerIndex, this.myName, this.opponentName);
      }
    });

    this._unsubscribe = () => this.roomRef.off('value', handler);
  }

  /* ── Send a move ─────────────────────────────────────────── */
  async sendMove(r, c, letter) {
    if (!this.roomRef) return;

    const role = this.playerIndex === 0 ? 'host' : 'guest';

    // Read current room state first
    const snap = await this.roomRef.once('value');
    const room = snap.val();

    // Validate it's our turn
    const expectedTurn = this.playerIndex; // 0 = host, 1 = guest
    if (room.turn !== expectedTurn) return;

    // Apply move to board locally and re-serialize
    const board = _deserializeBoard(room.board);
    board[r][c] = { letter: letter.toUpperCase(), owner: role, row: r, col: c };

    // Detect words server-side equivalent — use client trie
    let pts = 0, newWords = [], lastWord = room.lastWord || '';
    if (window.trie) {
      const words = detectWords(board, r, c, window.trie);
      for (const { word, cells } of words) {
        const key = cells.map(([rr, cc]) => `${rr},${cc}`).join('|');
        newWords.push(word);
        pts += scoreWord(word);
        lastWord = word;
      }
    }

    // Update scores
    const scores = { ...room.scores };
    const myScoreKey = this.playerIndex === 0 ? 'host' : 'guest';
    scores[myScoreKey] = (scores[myScoreKey] || 0) + pts;

    // Check win
    const WIN_SCORE = 20;
    let status = room.status;
    let winner = room.winner || null;
    if (scores[myScoreKey] >= WIN_SCORE) {
      status = 'finished';
      winner = this.myName;
    }

    // Check board full
    let filled = 0;
    for (let rr = 0; rr < 10; rr++) for (let cc = 0; cc < 10; cc++) if (board[rr][cc].letter) filled++;
    if (filled === 100 && status !== 'finished') {
      status = 'finished';
      winner = scores.host >= scores.guest ? room.host : room.guest;
    }

    // Write to Firebase
    await this.roomRef.update({
      board:     _serializeBoard(board),
      turn:      this.playerIndex === 0 ? 1 : 0,
      scores,
      lastMove:  { r, c, letter: letter.toUpperCase(), by: role, newWords },
      lastWord,
      status,
      winner:    winner || null,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  /* ── Cleanup ────────────────────────────────────────────── */
  leave() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    this.roomRef  = null;
    this.roomCode = null;
  }
}

/* ==========================================================
   BOARD SERIALIZATION
   Firebase stores JSON — we serialize the 10×10 board as
   a flat string for efficiency: "A:p1,null,B:p2,..." (100 entries)
   ========================================================== */

function _emptyBoard() {
  const b = [];
  for (let r = 0; r < 10; r++) {
    b[r] = [];
    for (let c = 0; c < 10; c++) b[r][c] = { letter: null, owner: null, row: r, col: c };
  }
  return b;
}

/** Serialize board to compact string for Firebase storage */
function _serializeBoard(board) {
  const parts = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      parts.push(cell.letter ? `${cell.letter}:${cell.owner}` : '.');
    }
  }
  return parts.join(',');
}

/** Deserialize compact string back to board array */
function _deserializeBoard(str) {
  const board = _emptyBoard();
  if (!str) return board;
  const parts = str.split(',');
  let i = 0;
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const p = parts[i++];
      if (p && p !== '.') {
        const [letter, owner] = p.split(':');
        board[r][c] = { letter, owner, row: r, col: c };
      }
    }
  }
  return board;
}

/* ==========================================================
   GAME.JS HOOKS — called from game.js
   ========================================================== */

/**
 * Called by game.js onLetterChosen() when gameMode === 'vs-firebase'
 */
function fbOnTileChosen(r, c, letter) {
  // Apply optimistically to local board immediately for responsiveness
  if (typeof placeLetterOnBoard === 'function') {
    placeLetterOnBoard(r, c, letter, 'p1');
  }
  // Then sync to Firebase
  window.fbMultiplayer?.sendMove(r, c, letter);
}

/**
 * Apply an opponent's move received from Firebase
 */
function applyFBMove(move, scores, nextTurn) {
  if (!move) return;

  // Apply to local board array
  if (typeof board !== 'undefined' && board[move.r]?.[move.c]) {
    board[move.r][move.c] = {
      letter: move.letter,
      owner:  'p2',
      row:    move.r,
      col:    move.c
    };
    if (typeof updateTileEl === 'function') updateTileEl(move.r, move.c);
  }

  // Flash scored tiles
  if (move.newWords?.length > 0 && typeof detectWords === 'function' && window.trie) {
    const words = detectWords(board, move.r, move.c, window.trie);
    const cellsToFlash = new Set();
    for (const { cells } of words) {
      for (const [rr, cc] of cells) cellsToFlash.add(`${rr},${cc}`);
    }
    if (typeof window.flashCells === 'function') window.flashCells(cellsToFlash);
  }

  // Update scores
  const myIndex = window.fbMultiplayer?.playerIndex || 0;
  if (typeof window.scores !== 'undefined') {
    window.scores.p1 = myIndex === 0 ? scores.host   : scores.guest;
    window.scores.p2 = myIndex === 0 ? scores.guest  : scores.host;
  }

  // Update turn
  if (typeof currentTurn !== 'undefined') {
    const myTurn = nextTurn === (window.fbMultiplayer?.playerIndex || 0);
    window.currentTurn = myTurn ? 'p1' : 'p2';
  }

  if (typeof updateHUD === 'function') updateHUD();
}

/**
 * Show win card for Firebase game
 */
function showFBWin(winnerName, scores, lastWord, myPlayerIndex, myName, opponentName) {
  const p1Won = winnerName === myName;
  if (typeof window.scores !== 'undefined') {
    window.scores.p1 = myPlayerIndex === 0 ? scores.host   : scores.guest;
    window.scores.p2 = myPlayerIndex === 0 ? scores.guest  : scores.host;
  }
  if (typeof window.lastWord !== 'undefined') window.lastWord = lastWord || '';
  if (typeof showWin === 'function') showWin(p1Won);
}

/**
 * Start the Firebase multiplayer game — transitions to game board
 */
function startFBMultiplayerGame(initialBoard, myName, opponentName, myPlayerIndex, firstTurn) {
  window.gameMode    = 'vs-firebase';
  window.currentTurn = firstTurn === myPlayerIndex ? 'p1' : 'p2';
  window.scores      = { p1: 0, p2: 0 };
  window.gameOver    = false;
  window.lastWord    = '';

  const p1Label = document.getElementById('p1-label');
  const p2Label = document.getElementById('p2-label');
  if (p1Label) p1Label.textContent = myName.substring(0, 8);
  if (p2Label) p2Label.textContent = opponentName.substring(0, 8);

  if (typeof showScreen  === 'function') showScreen('game');
  if (typeof renderBoard === 'function') renderBoard();

  // Apply initial board state
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (initialBoard[r][c]?.letter) {
        if (typeof board !== 'undefined') board[r][c] = initialBoard[r][c];
        if (typeof updateTileEl === 'function') updateTileEl(r, c);
      }
    }
  }

  if (typeof updateHUD === 'function') updateHUD();
}

/* ==========================================================
   LOBBY UI — rendered into the LOBBY tab
   (reuses same HTML structure as multiplayer-client.js)
   ========================================================== */

function renderFBLobbyScreen() {
  const panel = document.querySelector('[data-tab="lobby"]');
  if (!panel) return;

  const prof       = window.profile;
  const playerName = prof?.exists() ? prof.name : 'AGENT';

  panel.innerHTML = `
    <div class="lobby-screen">
      <header class="lobby-header">
        <button class="lobby-back-btn" id="lobby-back" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h2 class="lobby-title">Multiplayer Lobby</h2>
      </header>

      <!-- MODE SELECT -->
      <div id="lobby-mode-select" class="lobby-section">
        <h3 class="lobby-heading">CHOOSE A MODE</h3>
        <p class="lobby-sub">Host a private grove or join with a room code.</p>
        <button class="btn-play-primary" id="btn-create-room">
          🌿 CREATE PRIVATE GROVE
        </button>
        <div class="lobby-join-row">
          <input type="text" id="join-code-input" class="lobby-code-input"
                 placeholder="ENTER CODE (e.g. OAK-77)"
                 maxlength="7" autocomplete="off"
                 autocapitalize="characters" spellcheck="false"
                 aria-label="Room code" />
          <button class="btn-play-primary lobby-join-btn" id="btn-join-room">JOIN</button>
        </div>
        <p class="lobby-error hidden" id="lobby-error"></p>
        <p class="lobby-status-footer">
          ☁ POWERED BY FIREBASE · FREE FOREVER
        </p>
      </div>

      <!-- WAITING VIEW -->
      <div id="lobby-waiting" class="lobby-section hidden">
        <h3 class="lobby-heading accent">Waiting for a Friend…</h3>
        <p class="lobby-sub">Share this code to establish a connection</p>

        <div class="room-code-card">
          <span class="room-code-text" id="room-code-display">—</span>
        </div>

        <!-- Radar -->
        <div class="lobby-radar" aria-hidden="true">
          <div class="radar-ring radar-ring--3"></div>
          <div class="radar-ring radar-ring--2"></div>
          <div class="radar-ring radar-ring--1"></div>
          <div class="radar-centre">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span class="radar-question">?</span>
          </div>
        </div>

        <div class="connection-list">
          <div class="connection-row connection-row--connected">
            <div class="conn-avatar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="conn-info">
              <p class="conn-name">YOU (HOST)</p>
              <p class="conn-status">Connected</p>
            </div>
            <div class="conn-dot conn-dot--green"></div>
          </div>
          <div class="connection-row">
            <div class="conn-avatar conn-avatar--dim">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3"/>
                <path d="M22 21v-2c0-1.36-.88-2.52-2.12-2.88"/>
                <path d="M8 11c-1.66 0-3-1.34-3-3s1.34-3 3-3"/>
                <path d="M4 21v-2c0-1.36.88-2.52 2.12-2.88"/>
              </svg>
            </div>
            <div class="conn-info">
              <p class="conn-name searching">SEARCHING…</p>
              <p class="conn-status">Waiting for peer</p>
            </div>
            <div class="conn-dot conn-dot--dim"></div>
          </div>
        </div>

        <button class="btn-play-primary" id="btn-invite-friend">Invite Friend</button>
        <button class="btn-ghost" id="btn-cancel-match"
                style="color:var(--color-danger);border-color:var(--color-danger)">
          Cancel Matchmaking
        </button>

        <div class="lobby-growing-footer">
          <div class="lobby-growing-bar"></div>
          <span class="lobby-growing-label">GROWING WORD TREE…</span>
        </div>
      </div>

    </div>
  `;

  /* ── Wire up buttons ──────────────────────────────────────── */

  document.getElementById('lobby-back')?.addEventListener('click', () => {
    if (typeof switchToTab === 'function') switchToTab('battle');
  });

  document.getElementById('btn-create-room')?.addEventListener('click', async () => {
    const code = await window.fbMultiplayer.createRoom(playerName);
    if (code) {
      document.getElementById('room-code-display').textContent = code;
      document.getElementById('lobby-mode-select').classList.add('hidden');
      document.getElementById('lobby-waiting').classList.remove('hidden');
    }
  });

  document.getElementById('btn-join-room')?.addEventListener('click', () => {
    const code = document.getElementById('join-code-input')?.value.trim().toUpperCase();
    if (!code || code.length < 3) {
      showFBError('Enter a valid room code (e.g. OAK-77)');
      return;
    }
    window.fbMultiplayer.joinRoom(code, playerName);
  });

  document.getElementById('join-code-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-join-room')?.click();
  });

  document.getElementById('btn-invite-friend')?.addEventListener('click', () => {
    const code = document.getElementById('room-code-display')?.textContent;
    const text = `Join my Word Puzzle Battle! Room code: ${code}`;
    if (navigator.share) {
      navigator.share({ title: 'Word Puzzle Battle', text });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert(`Copied: ${code}`));
    }
  });

  document.getElementById('btn-cancel-match')?.addEventListener('click', () => {
    window.fbMultiplayer?.leave();
    document.getElementById('lobby-mode-select').classList.remove('hidden');
    document.getElementById('lobby-waiting').classList.add('hidden');
  });
}

function showFBError(msg) {
  console.warn('[WPB:FB]', msg);
  const el = document.getElementById('lobby-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

/* ==========================================================
   BOOT
   ========================================================== */
window.fbMultiplayer = new FirebaseMultiplayer();

// Lazy-render lobby UI on first tab click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.tab-btn[data-tab="lobby"]')?.addEventListener('click', () => {
    const panel = document.querySelector('[data-tab="lobby"]');
    if (panel && !panel.dataset.fbReady) {
      renderFBLobbyScreen();
      panel.dataset.fbReady = 'true';
    }
  });
});

// Expose globals so game.js can call them
window.fbOnTileChosen      = fbOnTileChosen;
window.applyFBMove         = applyFBMove;
window.showFBWin           = showFBWin;
window.startFBMultiplayerGame = startFBMultiplayerGame;
