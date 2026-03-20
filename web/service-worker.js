/**
 * Word Puzzle Battle — Service Worker
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 *
 * Free for personal/non-commercial use.
 * Commercial use requires a 27% gross revenue royalty agreement.
 * Attribution to the original author is mandatory in all derivatives.
 */

/* ── Bump this string on EVERY release so old caches are purged ─ */
const CACHE = 'wpb-v3';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/trie.js',
  '/game.js',
  '/ai-bot.js',
  '/profile.js',          /* ← NEW: player profile + stats */
  '/tutorial.js',
  '/auth.js',
  '/auth.css',
  '/firebase-multiplayer.js',
  '/multiplayer.css',
  '/config.js',
  '/tutorial.css',
  '/dictionary.json',
  '/manifest.json',
  '/privacy.html',
  '/terms.html',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
