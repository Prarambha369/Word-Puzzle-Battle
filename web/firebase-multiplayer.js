/**
 * Word Puzzle Battle — Firebase Multiplayer (No Server Required)
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

function _getFirebaseConfig() {
  const cfg = window.WPB_CONFIG?.firebase;
  if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith('YOUR_')) {
    console.error('[WPB:FB] Firebase config missing. Fill in web/config.js');
    return null;
  }
  return cfg;
}

const TREE_NAMES = ['OAK','ELM','ASH','YEW','FIR','GUM','BAY','IVY','KOA','BOX','TAK','WAX'];

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
    this.db           = null;
    this.roomRef      = null;
    this.roomCode     = null;
    this.playerIndex  = 0;
    this.myName       = 'AGENT';
    this.opponentName = 'GUEST';
    this._unsubscribe = null;
    this._initialized = false;
  }

  /* ── Init Firebase + anonymous auth ──────────────────────── */
  async init() {
    if (this._initialized) return true;
    if (typeof firebase === 'undefined') {
      console.error('[WPB:FB] Firebase SDK not loaded');
      return false;
    }
    try {
      const cfg = _getFirebaseConfig();
      if (!cfg) return false;
      if (!firebase.apps?.length) firebase.initializeApp(cfg);
      this.db = firebase.database();
      this._initialized = true;
      console.log('[WPB:FB] Firebase connected');

      // KEY FIX: sign in anonymously if user has no Firebase identity.
      // Without this, guests can't write rooms when rules say auth !== null.
      const currentUser = firebase.auth().currentUser;
      if (!currentUser) {
        try {
          await firebase.auth().signInAnonymously();
          console.log('[WPB:FB] Anonymous auth active');
        } catch (anonErr) {
          // Not fatal — rules allow open writes as fallback
          console.warn('[WPB:FB] Anonymous auth failed:', anonErr.code, anonErr.message);
        }
      } else {
        console.log('[WPB:FB] Auth already active:', currentUser.uid.slice(0,8));
      }
      return true;
    } catch (e) {
      console.error('[WPB:FB] Init failed:', e.message);
      return false;
    }
  }

  /* ── Create room (host) ────────────────────────────────────── */
  async createRoom(playerName) {
    if (!await this.init()) return null;   // ← was: this.init() without await
    this.myName      = playerName.toUpperCase().substring(0, 16);
    this.playerIndex = 0;

    let code;
    for (let i = 0; i < 10; i++) {
      code = generateRoomCode();
      const snap = await this.db.ref(`rooms/${code}`).once('value');
      if (!snap.exists()) break;
    }

    this.roomCode = code;
    this.roomRef  = this.db.ref(`rooms/${code}`);

    await this.roomRef.set({
      host:      this.myName,
      guest:     null,
      status:    'waiting',
      turn:      0,
      scores:    { host: 0, guest: 0 },
      board:     _serializeBoard(_emptyBoard()),
      lastMove:  null,
      lastWord:  '',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    // Auto-delete after 40 minutes
    setTimeout(() => this.roomRef?.remove(), 40 * 60 * 1000);
    console.log(`[WPB:FB] Room created: ${code}`);
    this._listenForGuest();
    return code;
  }

  /* ── Join room (guest) ─────────────────────────────────────── */
  async joinRoom(code, playerName) {
    if (!await this.init()) return false;  // ← was: this.init() without await
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
      showFBError('This room is full or the game has already started.');
      return false;
    }

    await this.roomRef.update({
      guest:     this.myName,
      status:    'playing',
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });

    this.opponentName = room.host;
    console.log(`[WPB:FB] Joined room ${this.roomCode}`);
    this._listenForGameState();

    showMatchReadyScreen(this.myName, this.opponentName, () => {
      startFBMultiplayerGame(
        _deserializeBoard(snap.val().board),
        this.myName, this.opponentName, this.playerIndex, 0
      );
    });
    return true;
  }

  /* ── Host listens for guest ────────────────────────────────── */
  _listenForGuest() {
    const guestRef = this.roomRef.child('guest');
    const off = guestRef.on('value', snap => {
      if (!snap.val()) return;
      guestRef.off('value', off);
      this.opponentName = snap.val();

      this.roomRef.once('value').then(roomSnap => {
        const room = roomSnap.val();
        showMatchReadyScreen(this.myName, this.opponentName, () => {
          startFBMultiplayerGame(
            _deserializeBoard(room.board),
            this.myName, this.opponentName, this.playerIndex, 0
          );
          this._listenForGameState();
        });
      });
    });
  }

  /* ── Listen for game state changes ────────────────────────── */
  _listenForGameState() {
    if (this._unsubscribe) this._unsubscribe();

    const handler = this.roomRef.on('value', snap => {
      if (!snap.exists()) return;
      const room = snap.val();

      if (room.lastMove) {
        const move  = room.lastMove;
        const isMine = (this.playerIndex === 0 && move.by === 'host') ||
                       (this.playerIndex === 1 && move.by === 'guest');
        if (!isMine) applyFBMove(move, room.scores, room.turn);
      }

      if (room.status === 'finished' && room.winner) {
        showFBWin(room.winner, room.scores, room.lastWord,
                  this.playerIndex, this.myName, this.opponentName);
      }
    });

    this._unsubscribe = () => this.roomRef.off('value', handler);
  }

  /* ── Send a move ───────────────────────────────────────────── */
  async sendMove(r, c, letter) {
    if (!this.roomRef) return;
    const role = this.playerIndex === 0 ? 'host' : 'guest';

    const snap = await this.roomRef.once('value');
    const room  = snap.val();

    if (room.turn !== this.playerIndex) return;

    const board = _deserializeBoard(room.board);
    board[r][c] = { letter: letter.toUpperCase(), owner: role, row: r, col: c };

    let pts = 0, newWords = [], lastWord = room.lastWord || '';
    if (window.trie) {
      const words = detectWords(board, r, c, window.trie);
      for (const { word } of words) { newWords.push(word); pts += scoreWord(word); lastWord = word; }
    }

    const scores = { ...room.scores };
    scores[role] = (scores[role] || 0) + pts;

    let status = room.status, winner = room.winner || null;
    if (scores[role] >= 20) { status = 'finished'; winner = this.myName; }

    let filled = 0;
    for (let rr = 0; rr < 10; rr++) for (let cc = 0; cc < 10; cc++) if (board[rr][cc].letter) filled++;
    if (filled === 100 && status !== 'finished') {
      status = 'finished';
      winner = scores.host >= scores.guest ? room.host : room.guest;
    }

    await this.roomRef.update({
      board:     _serializeBoard(board),
      turn:      this.playerIndex === 0 ? 1 : 0,
      scores, lastMove: { r, c, letter: letter.toUpperCase(), by: role, newWords },
      lastWord, status, winner: winner || null,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  }

  leave() {
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    this.roomRef = null; this.roomCode = null;
  }
}

/* ==========================================================
   BOARD SERIALIZATION
   ========================================================== */
function _emptyBoard() {
  const b = [];
  for (let r = 0; r < 10; r++) {
    b[r] = [];
    for (let c = 0; c < 10; c++) b[r][c] = { letter: null, owner: null, row: r, col: c };
  }
  return b;
}

function _serializeBoard(board) {
  const parts = [];
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      parts.push(cell.letter ? `${cell.letter}:${cell.owner}` : '.');
    }
  return parts.join(',');
}

function _deserializeBoard(str) {
  const board = _emptyBoard();
  if (!str) return board;
  const parts = str.split(',');
  let i = 0;
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++) {
      const p = parts[i++];
      if (p && p !== '.') {
        const [letter, owner] = p.split(':');
        board[r][c] = { letter, owner, row: r, col: c };
      }
    }
  return board;
}

/* ==========================================================
   MATCH READY SCREEN
   ========================================================== */
function showMatchReadyScreen(myName, opponentName, onStart) {
  document.getElementById('match-ready-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'match-ready-overlay';
  overlay.className = 'match-ready-overlay';

  const myInitial  = (myName[0]       || '?').toUpperCase();
  const oppInitial = (opponentName[0] || '?').toUpperCase();

  overlay.innerHTML = `
    <div class="mr-header">
      <button class="mr-back-btn" id="mr-back" aria-label="Back">←</button>
      <div>
        <div class="mr-title">MATCH READY</div>
        <div class="mr-lobby-pill">GROVE SESSION ACTIVE</div>
      </div>
      <span style="width:44px"></span>
    </div>

    <div class="mr-headline">
      <div class="mr-big-title">PREPARE FOR BATTLE</div>
      <div class="mr-sub">Root systems aligned. Connection established.</div>
    </div>

    <div class="mr-player-card mr-player-card--ready">
      <div class="mr-card-header">
        <div>
          <div class="mr-player-label">PLAYER 1</div>
          <div class="mr-player-name">${myName}</div>
        </div>
        <div class="mr-dot mr-dot--green" aria-hidden="true"></div>
      </div>
      <div class="mr-avatar-area">
        <div class="mr-avatar-circle">${myInitial}</div>
      </div>
      <div class="mr-ready-badge">READY TO ENGAGE</div>
    </div>

    <div class="mr-vs-circle" aria-hidden="true">VS</div>

    <div class="mr-player-card">
      <div class="mr-card-header">
        <div>
          <div class="mr-player-label" style="color:#6b8c72">PLAYER 2</div>
          <div class="mr-player-name" style="color:#e8f0e8">${opponentName}</div>
        </div>
      </div>
      <div class="mr-avatar-area mr-avatar-area--scanning">
        <div class="mr-avatar-circle" style="background:#243328;color:#6b8c72">${oppInitial}</div>
      </div>
      <div class="mr-scanning-dots" aria-label="Opponent syncing">
        <span></span><span></span><span></span>
      </div>
    </div>

    <button class="btn-primary mr-start-btn" id="mr-start-btn">
      START BATTLE ⚡
    </button>

    <div class="mr-footer">
      <span>SIGNAL: STRONG</span>
      <span>GROVE: ACTIVE</span>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('mr-start-btn').addEventListener('click', () => {
    overlay.remove();
    onStart();
  });
  document.getElementById('mr-back').addEventListener('click', () => {
    overlay.remove();
    window.fbMultiplayer?.leave();
  });
}

/* ==========================================================
   GAME.JS HOOKS
   ========================================================== */
function fbOnTileChosen(r, c, letter) {
  if (typeof placeLetterOnBoard === 'function') placeLetterOnBoard(r, c, letter, 'p1');
  window.fbMultiplayer?.sendMove(r, c, letter);
}

function applyFBMove(move, scores, nextTurn) {
  if (!move) return;
  if (typeof board !== 'undefined' && board[move.r]?.[move.c]) {
    board[move.r][move.c] = { letter: move.letter, owner: 'p2', row: move.r, col: move.c };
    if (typeof updateTileEl === 'function') updateTileEl(move.r, move.c);
  }
  if (move.newWords?.length > 0 && window.trie) {
    const words = detectWords(board, move.r, move.c, window.trie);
    const cells = new Set();
    for (const { cells: wc } of words) for (const [rr,cc] of wc) cells.add(`${rr},${cc}`);
    if (typeof window.flashCells === 'function') window.flashCells(cells);
  }
  const myIdx = window.fbMultiplayer?.playerIndex || 0;
  if (typeof window.scores !== 'undefined') {
    window.scores.p1 = myIdx === 0 ? scores.host  : scores.guest;
    window.scores.p2 = myIdx === 0 ? scores.guest : scores.host;
  }
  window.currentTurn = nextTurn === (window.fbMultiplayer?.playerIndex || 0) ? 'p1' : 'p2';
  if (typeof updateHUD === 'function') updateHUD();
}

function showFBWin(winnerName, scores, lastWord, myPlayerIndex, myName, opponentName) {
  const p1Won = winnerName === myName;
  if (typeof window.scores !== 'undefined') {
    window.scores.p1 = myPlayerIndex === 0 ? scores.host  : scores.guest;
    window.scores.p2 = myPlayerIndex === 0 ? scores.guest : scores.host;
  }
  if (typeof window.lastWord !== 'undefined') window.lastWord = lastWord || '';
  if (typeof showWin === 'function') showWin(p1Won);
}

function startFBMultiplayerGame(initialBoard, myName, opponentName, myPlayerIndex, firstTurn) {
  window.gameMode    = 'vs-firebase';
  window.currentTurn = firstTurn === myPlayerIndex ? 'p1' : 'p2';
  window.scores      = { p1: 0, p2: 0 };
  window.gameOver    = false;
  window.lastWord    = '';

  const p1Label = document.getElementById('p1-label');
  const p2Label = document.getElementById('p2-label');
  if (p1Label) p1Label.textContent = myName.substring(0,8);
  if (p2Label) p2Label.textContent = opponentName.substring(0,8);

  if (typeof showScreen  === 'function') showScreen('game');
  if (typeof renderBoard === 'function') renderBoard();

  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    if (initialBoard[r][c]?.letter) {
      if (typeof board !== 'undefined') board[r][c] = initialBoard[r][c];
      if (typeof updateTileEl === 'function') updateTileEl(r, c);
    }
  }
  if (typeof updateHUD === 'function') updateHUD();
}

/* ==========================================================
   LOBBY UI
   ========================================================== */
function renderFBLobbyScreen() {
  const panel = document.querySelector('[data-tab="lobby"]');
  if (!panel) return;

  const auth = window.auth;
  const prof = window.profile;
  const playerName = (auth?.isSignedIn ? auth.name : prof?.name) || 'AGENT';

  panel.innerHTML = `
    <div class="lobby-screen">
      <header class="lobby-header">
        <button class="lobby-back-btn" id="lobby-back" aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <h2 class="lobby-title">Multiplayer Lobby</h2>
      </header>

      <div id="lobby-mode-select" class="lobby-section">
        <h3 class="lobby-heading accent">MULTIPLAYER</h3>
        <p class="lobby-sub">Host a private grove or join with a room code.</p>
        <button class="btn-play-primary" id="btn-create-room">🌿 CREATE PRIVATE GROVE</button>
        <div class="lobby-join-row">
          <input type="text" id="join-code-input" class="lobby-code-input"
                 placeholder="ENTER CODE (e.g. OAK-77)"
                 maxlength="7" autocomplete="off"
                 autocapitalize="characters" spellcheck="false"
                 aria-label="Room code" />
          <button class="btn-play-primary lobby-join-btn" id="btn-join-room">JOIN</button>
        </div>
        <p class="lobby-error hidden" id="lobby-error"></p>
        <p class="lobby-status-footer">☁ POWERED BY FIREBASE · FREE FOREVER</p>
      </div>

      <div id="lobby-waiting" class="lobby-section hidden">
        <h3 class="lobby-heading accent">Waiting for a Friend…</h3>
        <p class="lobby-sub">Share this code to establish a connection</p>
        <div class="room-code-card">
          <span class="room-code-text" id="room-code-display">—</span>
        </div>
        <div class="lobby-radar" aria-hidden="true">
          <div class="radar-ring radar-ring--3"></div>
          <div class="radar-ring radar-ring--2"></div>
          <div class="radar-ring radar-ring--1"></div>
          <div class="radar-centre">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
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
            <div class="conn-avatar">YOU</div>
            <div class="conn-info">
              <p class="conn-name">YOU (HOST)</p>
              <p class="conn-status">Connected</p>
            </div>
            <div class="conn-dot conn-dot--green"></div>
          </div>
          <div class="connection-row">
            <div class="conn-avatar conn-avatar--dim">?</div>
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
    </div>`;

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
    if (!code || code.length < 3) { showFBError('Enter a valid room code (e.g. OAK-77)'); return; }
    window.fbMultiplayer.joinRoom(code, playerName);
  });

  document.getElementById('join-code-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-join-room')?.click();
  });

  document.getElementById('btn-invite-friend')?.addEventListener('click', () => {
    const code = document.getElementById('room-code-display')?.textContent;
    const text = `Join my Word Puzzle Battle! Room code: ${code}`;
    if (navigator.share) navigator.share({ title: 'Word Puzzle Battle', text });
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => alert(`Copied: ${code}`));
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

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.tab-btn[data-tab="lobby"]')?.addEventListener('click', () => {
    const panel = document.querySelector('[data-tab="lobby"]');
    if (panel && !panel.dataset.fbReady) {
      renderFBLobbyScreen();
      panel.dataset.fbReady = 'true';
    }
  });
});

window.fbOnTileChosen         = fbOnTileChosen;
window.applyFBMove            = applyFBMove;
window.showFBWin              = showFBWin;
window.startFBMultiplayerGame = startFBMultiplayerGame;
window.showMatchReadyScreen   = showMatchReadyScreen;
