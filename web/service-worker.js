/**
 * Word Puzzle Battle — Service Worker
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * https://github.com/Prarambha369/Word-Puzzle-Battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

const CACHE = 'wpb-v2';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './trie.js',
  './ai-bot.js',
  './dictionary.json',
  './manifest.json',
  './favicon.ico',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/og-image.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
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
