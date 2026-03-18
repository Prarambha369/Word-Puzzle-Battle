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

class TrieNode {
  constructor() {
    this.children = {};
    this.isWord   = false;
  }
}

class Trie {
  constructor() { this.root = new TrieNode(); }

  /** @param {string} word */
  insert(word) {
    let n = this.root;
    for (const ch of word.toUpperCase()) {
      if (!n.children[ch]) n.children[ch] = { children: {}, isWord: false };
      n = n.children[ch];
    }
    n.isWord = true;
  }

  /** @param {string} word @returns {boolean} */
  search(word) {
    let n = this.root;
    for (const ch of word.toUpperCase()) {
      if (!n.children[ch]) return false;
      n = n.children[ch];
    }
    return n.isWord === true;
  }

  /** @param {string} prefix @returns {boolean} */
  startsWith(prefix) {
    let n = this.root;
    for (const ch of prefix.toUpperCase()) {
      if (!n.children[ch]) return false;
      n = n.children[ch];
    }
    return true;
  }
}

/* Worker source — builds plain-object trie in background thread,
   posts the completed root back via structured clone.
   Main thread hot-swaps trie.root = e.data.root (O(1), no rebuild). */
const _workerSrc = `
'use strict';
function buildRoot(words) {
  const root = { children: {}, isWord: false };
  for (const word of words) {
    let n = root;
    for (const ch of word) {
      if (!n.children[ch]) n.children[ch] = { children: {}, isWord: false };
      n = n.children[ch];
    }
    n.isWord = true;
  }
  return root;
}
self.onmessage = function(e) {
  if (e.data.type !== 'build') return;
  const root = buildRoot(e.data.words);
  self.postMessage({ type: 'ready', root });
};
`;

/**
 * Fetches dictionary.json, builds Trie in a Web Worker (truly offloaded),
 * then calls onReady(trie). Falls back to sync build if Workers unavailable.
 * @param {function(Trie): void} onReady
 */
function buildTrieAsync(onReady) {
  fetch('./dictionary.json')
    .then(r => {
      if (!r.ok) throw new Error('dictionary.json: HTTP ' + r.status);
      return r.json();
    })
    .then(words => {
      let worker = null;
      try {
        const blob = new Blob([_workerSrc], { type: 'application/javascript' });
        const url  = URL.createObjectURL(blob);
        worker = new Worker(url);
        URL.revokeObjectURL(url);
      } catch (_) { worker = null; }

      if (worker) {
        worker.onmessage = function(e) {
          if (e.data.type !== 'ready') return;
          worker.terminate();
          const trie = new Trie();
          trie.root  = e.data.root;
          onReady(trie);
        };
        worker.onerror = function(err) {
          console.warn('[WPB] Worker failed, falling back:', err.message);
          worker.terminate();
          _buildSync(words, onReady);
        };
        worker.postMessage({ type: 'build', words });
      } else {
        _buildSync(words, onReady);
      }
    })
    .catch(err => {
      console.error('[WPB] dictionary.json load failed:', err.message);
      const badge = document.getElementById('turn-badge');
      if (badge) badge.textContent = 'DICT ERROR';
    });
}

/** Synchronous fallback — only used when Workers unavailable. */
function _buildSync(words, onReady) {
  console.warn('[WPB] Building trie on main thread.');
  const trie = new Trie();
  for (const w of words) trie.insert(w);
  onReady(trie);
}
