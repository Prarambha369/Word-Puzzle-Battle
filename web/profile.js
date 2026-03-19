/**
 * Word Puzzle Battle — Player Profile
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

/* ==========================================================
   PROFILE MODEL
   ========================================================== */

class Profile {
  constructor() {
    this._key = 'wpb-profile';
    this.data = this._load();
  }

  /** @returns {boolean} true if a profile has been created */
  exists() { return this.data !== null; }

  /** Player display name, uppercase */
  get name() { return this.data?.name || 'AGENT'; }

  /** First letter of name for avatar circles */
  get initial() { return (this.data?.name || 'A')[0].toUpperCase(); }

  get gamesPlayed() { return this.data?.gamesPlayed || 0; }
  get gamesWon()    { return this.data?.gamesWon    || 0; }
  get wordsFound()  { return this.data?.wordsFound  || 0; }
  get totalPoints() { return this.data?.totalPoints || 0; }

  /** Win ratio as a percentage string e.g. "67%" */
  get winRate() {
    if (!this.gamesPlayed) return '—';
    return Math.round((this.gamesWon / this.gamesPlayed) * 100) + '%';
  }

  /**
   * Creates and persists a new profile.
   * @param {string} name
   */
  create(name) {
    const cleaned = name.trim().toUpperCase().replace(/[^A-Z0-9_\- ]/gi, '') || 'AGENT';
    this.data = {
      name:        cleaned.substring(0, 16),
      createdAt:   Date.now(),
      gamesPlayed: 0,
      gamesWon:    0,
      wordsFound:  0,
      totalPoints: 0,
    };
    this._save();
    console.log('[WPB] Profile created:', this.data.name);
  }

  /**
   * Records a completed game into persistent stats.
   * @param {{ won: boolean, wordsFound: number, points: number }} result
   */
  recordGame({ won, wordsFound, points }) {
    if (!this.data) return;
    this.data.gamesPlayed += 1;
    if (won) this.data.gamesWon += 1;
    this.data.wordsFound  += (wordsFound || 0);
    this.data.totalPoints += (points    || 0);
    this._save();
  }

  /** Wipes profile and resets data to null. */
  signOut() {
    this.data = null;
    localStorage.removeItem(this._key);
    console.log('[WPB] Profile signed out');
  }

  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _save() {
    try {
      localStorage.setItem(this._key, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[WPB] Profile save failed:', e);
    }
  }
}

/* ==========================================================
   PROFILE SETUP MODAL
   Controls the "enter your name" gate shown on first launch
   or after sign-out. Not a class — just functions that
   operate on the modal DOM element.
   ========================================================== */

/**
 * Show the profile setup modal.
 * @param {function} onConfirm  — called with the entered name
 */
function showProfileSetup(onConfirm) {
  const modal = document.getElementById('profile-modal');
  const input = document.getElementById('profile-name-input');
  const btn   = document.getElementById('profile-setup-confirm');
  const err   = document.getElementById('profile-name-error');

  if (!modal) return;

  // Reset state
  if (input) { input.value = ''; input.focus(); }
  if (err)   err.classList.add('hidden');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  function handleConfirm() {
    const name = input ? input.value.trim() : '';
    if (!name || name.length < 2) {
      if (err) err.classList.remove('hidden');
      if (input) { input.classList.add('input--error'); input.focus(); }
      return;
    }
    if (err) err.classList.add('hidden');
    if (input) input.classList.remove('input--error');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    btn.removeEventListener('click', handleConfirm);
    if (input) input.removeEventListener('keydown', handleKey);
    onConfirm(name);
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleConfirm();
    if (input) input.classList.remove('input--error');
    if (err)   err.classList.add('hidden');
  }

  btn.addEventListener('click', handleConfirm);
  if (input) input.addEventListener('keydown', handleKey);
}

/**
 * Refreshes the account card in the settings tab with current profile data.
 * Called after create/signOut so the UI stays in sync.
 */
function refreshProfileUI() {
  const prof = window.profile;

  // Settings account card
  const avatarEl   = document.getElementById('settings-avatar');
  const nameEl     = document.getElementById('settings-profile-name');
  const statusEl   = document.getElementById('settings-profile-status');

  if (avatarEl)  avatarEl.textContent = prof.exists() ? prof.initial : '?';
  if (nameEl)    nameEl.textContent   = prof.exists() ? prof.name    : '—';
  if (statusEl)  statusEl.textContent = prof.exists() ? 'STATUS: GROWTH ACTIVE' : 'NOT SIGNED IN';

  // Stats in settings
  const statPlayed = document.getElementById('stat-games-played');
  const statWon    = document.getElementById('stat-games-won');
  const statWords  = document.getElementById('stat-words-found');
  const statWin    = document.getElementById('stat-win-rate');

  if (statPlayed) statPlayed.textContent = prof.gamesPlayed;
  if (statWon)    statWon.textContent    = prof.gamesWon;
  if (statWords)  statWords.textContent  = prof.wordsFound;
  if (statWin)    statWin.textContent    = prof.winRate;
}

/* ==========================================================
   BOOT
   ========================================================== */
window.profile = new Profile();
window.showProfileSetup  = showProfileSetup;
window.refreshProfileUI  = refreshProfileUI;
