/**
 * Word Puzzle Battle — Google Authentication
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

/* ==========================================================
   AUTH MANAGER
   ========================================================== */
class AuthManager {
  constructor() {
    this.user       = null;
    this.profile    = null;
    this.db         = null;
    this._listeners = [];
  }

  /* ── Initialize ─────────────────────────────────────────── */
  init() {
    if (typeof firebase === 'undefined') {
      console.error('[WPB:Auth] Firebase SDK not loaded');
      return false;
    }
    const cfg = window.WPB_CONFIG?.firebase;
    if (!cfg?.apiKey || cfg.apiKey.startsWith('YOUR_')) {
      console.error('[WPB:Auth] Config missing — fill in web/config.js');
      return false;
    }
    if (!firebase.apps?.length) firebase.initializeApp(cfg);
    this.db = firebase.database();
    firebase.auth().onAuthStateChanged(user => this._onAuthState(user));
    return true;
  }

  /* ── Auth state handler ─────────────────────────────────── */
  async _onAuthState(user) {
    if (user) {
      this.user = user;
      await this._loadOrCreateProfile(user);
      hideAuthScreen();
      this._notifyListeners('signed-in');
      console.log('[WPB:Auth] Signed in:', user.displayName || user.uid);
    } else {
      this.user    = null;
      this.profile = null;
      showAuthScreen();
      this._notifyListeners('signed-out');
      console.log('[WPB:Auth] Signed out');
    }
  }

  /* ── Load or create profile in Firebase DB ──────────────── */
  async _loadOrCreateProfile(user) {
    const ref  = this.db.ref(`users/${user.uid}`);
    const snap = await ref.once('value');

    if (snap.exists()) {
      this.profile = snap.val();
      await ref.update({
        name:     user.displayName || this.profile.name || 'AGENT',
        photoURL: user.photoURL    || this.profile.photoURL || null,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
      this.profile.name     = user.displayName || this.profile.name;
      this.profile.photoURL = user.photoURL    || this.profile.photoURL;
    } else {
      this.profile = {
        name:        user.displayName || 'AGENT',
        photoURL:    user.photoURL    || null,
        email:       user.email       || null,
        gamesPlayed: 0,
        gamesWon:    0,
        wordsFound:  0,
        totalPoints: 0,
        createdAt:   firebase.database.ServerValue.TIMESTAMP,
        lastSeen:    firebase.database.ServerValue.TIMESTAMP
      };
      await ref.set(this.profile);
    }

    _syncToLocalProfile(this.profile);
    refreshAllProfileUI();
  }

  /* ── Sign in with Google — popup first, redirect fallback ── */
  async signInWithGoogle() {
    const btn = document.getElementById('auth-google-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Connecting…'; }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        await firebase.auth().signInWithPopup(provider);
      } catch (popupError) {
        if (popupError.code === 'auth/popup-blocked') {
          await firebase.auth().signInWithRedirect(provider);
        } else {
          throw popupError;
        }
      }
    } catch (e) {
      console.error('[WPB:Auth] Sign-in failed:', e.message);
      showAuthError(_friendlyError(e.code));
      if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
    }
  }

  /* ── Sign out ───────────────────────────────────────────── */
  async signOut() {
    await firebase.auth().signOut();
  }

  /* ── Record game result to Firebase DB ──────────────────── */
  async recordGame({ won, wordsFound, points }) {
    if (!this.user || !this.profile) return;
    const ref = this.db.ref(`users/${this.user.uid}`);
    await ref.update({
      gamesPlayed: firebase.database.ServerValue.increment(1),
      gamesWon:    firebase.database.ServerValue.increment(won ? 1 : 0),
      wordsFound:  firebase.database.ServerValue.increment(wordsFound || 0),
      totalPoints: firebase.database.ServerValue.increment(points    || 0),
      lastSeen:    firebase.database.ServerValue.TIMESTAMP
    });
    const snap = await ref.once('value');
    this.profile = snap.val();
    _syncToLocalProfile(this.profile);
    refreshAllProfileUI();
  }

  /* ── Getters ────────────────────────────────────────────── */
  get isSignedIn()  { return this.user !== null; }
  get name()        { return this.profile?.name     || 'AGENT'; }
  get initial()     { return (this.name[0] || 'A').toUpperCase(); }
  get photoURL()    { return this.profile?.photoURL || null; }
  get gamesPlayed() { return this.profile?.gamesPlayed || 0; }
  get gamesWon()    { return this.profile?.gamesWon    || 0; }
  get wordsFound()  { return this.profile?.wordsFound  || 0; }
  get totalPoints() { return this.profile?.totalPoints || 0; }
  get winRate() {
    if (!this.gamesPlayed) return '—';
    return Math.round((this.gamesWon / this.gamesPlayed) * 100) + '%';
  }

  onChange(fn) { this._listeners.push(fn); }
  _notifyListeners(event) { this._listeners.forEach(fn => fn(event)); }
}

/* ==========================================================
   SYNC TO LOCAL PROFILE.JS
   Keeps existing game.js code working without changes.
   ========================================================== */
function _syncToLocalProfile(fbProfile) {
  if (!window.profile) return;
  window.profile.data = {
    name:        fbProfile.name        || 'AGENT',
    gamesPlayed: fbProfile.gamesPlayed || 0,
    gamesWon:    fbProfile.gamesWon    || 0,
    wordsFound:  fbProfile.wordsFound  || 0,
    totalPoints: fbProfile.totalPoints || 0,
    createdAt:   fbProfile.createdAt   || Date.now()
  };
}

/* ==========================================================
   AUTH SCREEN UI
   Full-screen gate shown before the game loads.
   ========================================================== */
function buildAuthScreen() {
  if (document.getElementById('auth-screen')) return;

  const el = document.createElement('div');
  el.id        = 'auth-screen';
  el.className = 'auth-screen';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Sign in to play');

  el.innerHTML = `
    <div class="auth-card">

      <div class="auth-logo" aria-hidden="true">
        <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="authGlow" cx="58%" cy="50%" r="40%">
              <stop offset="0%"   stop-color="#1a5e24" stop-opacity="0.6"/>
              <stop offset="100%" stop-color="#091609" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="80" height="80" rx="16" fill="#0d2010"/>
          <rect width="80" height="80" rx="16" fill="url(#authGlow)"/>
          <g transform="translate(40,40)">
            <path d="M0,-18 C10,-18 18,-10 18,0 C18,12 9,20 0,20 C-12,20 -20,10 -20,0 C-20,-14 -9,-24 8,-24"
                  fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M0,-10 C6,-10 11,-6 11,0 C11,8 5,13 0,13 C-7,13 -12,7 -12,0 C-12,-8 -5,-14 4,-15"
                  fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>
            <circle cx="0" cy="0" r="3" fill="#22c55e"/>
          </g>
        </svg>
      </div>

      <h1 class="auth-title">
        <span class="auth-title-word">WORD</span>
        <span class="auth-title-puzzle">PUZZLE</span>
        <span class="auth-title-battle">BATTLE</span>
      </h1>
      <p class="auth-tagline">EXPANSION PROTOCOL INITIATED</p>

      <div class="auth-signin-section">
        <p class="auth-prompt">Sign in to save your stats and play online</p>

        <button class="auth-google-btn" id="auth-google-btn" aria-label="Continue with Google">
          <svg class="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div class="auth-divider">
          <span class="auth-divider-line"></span>
          <span class="auth-divider-text">or</span>
          <span class="auth-divider-line"></span>
        </div>

        <button class="auth-guest-btn" id="auth-guest-btn">
          Play as Guest
        </button>
        <p class="auth-guest-note">Guest stats are saved locally only</p>
      </div>

      <p class="auth-error hidden" id="auth-error" role="alert"></p>

      <p class="auth-footer">
        By playing you agree to the
        <a href="terms.html" target="_blank" rel="noopener" class="auth-link">
          Forest Rules of Engagement
        </a>
      </p>
    </div>
  `;

  document.body.appendChild(el);

  document.getElementById('auth-google-btn')?.addEventListener('click', () => {
    window.auth.signInWithGoogle();
  });

  document.getElementById('auth-guest-btn')?.addEventListener('click', () => {
    _handleGuestPlay();
  });

  // Handle any pending redirect result (fallback flow only)
  if (typeof firebase !== 'undefined') {
    firebase.auth().getRedirectResult()
      .then(result => {
        if (result?.user) console.log('[WPB:Auth] Redirect sign-in complete');
      })
      .catch(e => {
        if (e.code &&
            e.code !== 'auth/no-current-user' &&
            !e.message?.includes('missing initial state')) {
          showAuthError(_friendlyError(e.code));
        }
      });
  }
}

function showAuthScreen() {
  const el = document.getElementById('auth-screen');
  if (el) el.classList.remove('hidden');
}

function hideAuthScreen() {
  const el = document.getElementById('auth-screen');
  if (el) el.classList.add('hidden');
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

/* Guest flow — fall back to local profile.js */
function _handleGuestPlay() {
  hideAuthScreen();
  if (window.profile && !window.profile.exists()) {
    if (typeof showProfileSetup === 'function') {
      showProfileSetup(name => {
        window.profile.create(name);
        refreshAllProfileUI();
        if (window.tutorial?.shouldShowTutorial()) window.tutorial.show();
      });
    }
  } else {
    refreshAllProfileUI();
    if (window.tutorial?.shouldShowTutorial()) window.tutorial.show();
  }
}

/* Map Firebase error codes to friendly messages */
function _friendlyError(code) {
  const map = {
    'auth/popup-closed-by-user':     'Sign-in cancelled.',
    'auth/popup-blocked':            'Popup blocked — allow popups for this site.',
    'auth/network-request-failed':   'No internet connection.',
    'auth/cancelled-popup-request':  'Sign-in cancelled.',
    'auth/user-disabled':            'This account has been disabled.',
    'auth/account-exists-with-different-credential': 'Account exists with a different sign-in method.'
  };
  return map[code] || 'Sign-in failed. Please try again.';
}

/* ==========================================================
   REFRESH UI HELPERS
   Called after any auth/profile change.
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
    ? '☁ SYNCED TO CLOUD'
    : '💾 LOCAL STORAGE';
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
  if (signOutBtn) {
    signOutBtn.textContent = auth?.isSignedIn ? 'SIGN OUT' : 'SIGNED IN AS GUEST';
  }
}

/* ==========================================================
   GAME RESULT HOOK — called by game.js after every win
   ========================================================== */
async function recordGameResult({ won, wordsFound, points }) {
  if (window.auth?.isSignedIn) {
    await window.auth.recordGame({ won, wordsFound, points });
  } else if (window.profile?.exists()) {
    window.profile.recordGame({ won, wordsFound, points });
    refreshAllProfileUI();
  }
}

/* ==========================================================
   SIGN-OUT HANDLER — wired in game.js initSettings()
   ========================================================== */
async function handleSignOut() {
  if (window.auth?.isSignedIn) {
    await window.auth.signOut();
  } else {
    window.profile?.signOut();
    showAuthScreen();
  }
}

/* ==========================================================
   BOOT
   ========================================================== */
window.auth = new AuthManager();

document.addEventListener('DOMContentLoaded', () => {
  buildAuthScreen();
  window.auth.init();
});

window.refreshAllProfileUI = refreshAllProfileUI;
window.recordGameResult    = recordGameResult;
window.handleSignOut       = handleSignOut;
