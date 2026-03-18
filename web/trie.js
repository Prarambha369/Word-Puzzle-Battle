/**
 * Word Puzzle Battle
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 *
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 *
 * Free for personal/non-commercial use.
 * Commercial use requires a 27% gross revenue royalty agreement.
 * Attribution to the original author is mandatory in all derivatives.
 */
'use strict';

/* ==========================================================
   TrieNode + Trie — main thread classes
   search() and startsWith() work on plain {children,isWord}
   objects too, so the Worker can avoid class instantiation.
   ========================================================== */

class TrieNode {
  constructor() {
    this.children = {};
    this.isWord   = false;
  }
}

class Trie {
  constructor() { this.root = new TrieNode(); }

  /**
   * Inserts a word into the trie. O(k).
   * @param {string} word
   */
  insert(word) {
    let n = this.root;
    for (const ch of word.toUpperCase()) {
      if (!n.children[ch]) n.children[ch] = { children: {}, isWord: false };
      n = n.children[ch];
    }
    n.isWord = true;
  }

  /**
   * Returns true if the exact word exists. O(k).
   * Works on plain-object nodes as well as TrieNode instances.
   * @param {string} word
   * @returns {boolean}
   */
  search(word) {
    let n = this.root;
    for (const ch of word.toUpperCase()) {
      if (!n.children[ch]) return false;
      n = n.children[ch];
    }
    return n.isWord === true;
  }

  /**
   * Returns true if any word starts with prefix. O(k).
   * Used by Hard AI to prune dead-end letter sequences.
   * Works on plain-object nodes as well as TrieNode instances.
   * @param {string} prefix
   * @returns {boolean}
   */
  startsWith(prefix) {
    let n = this.root;
    for (const ch of prefix.toUpperCase()) {
      if (!n.children[ch]) return false;
      n = n.children[ch];
    }
    return true;
  }
}

/* ==========================================================
   Worker source — runs in background thread.

   Builds the trie as plain {children, isWord} objects (faster
   to construct than class instances, and structured-cloneable
   without any extra serialization step).

   Posts {type:'ready', root} when done — root is the fully
   built tree, ready to be hot-swapped into the main Trie.
   ========================================================== */

const _workerSrc = `
'use strict';
/**
 * Builds a plain-object trie root from a word array.
 * Plain objects are faster to create than class instances
 * and transfer cleanly via structured clone.
 * @param {string[]} words - uppercase words
 * @returns {{ children: {}, isWord: boolean }}
 */
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

self.onmessage = function (e) {
  if (e.data.type !== 'build') return;
  const root = buildRoot(e.data.words);
  // Post the completed root back to the main thread.
  // Structured clone transfers the entire tree — main thread
  // just assigns it; no re-insertion required.
  self.postMessage({ type: 'ready', root });
};
`;

/* ==========================================================
   buildTrieAsync — public API consumed by game.js

   Timeline:
   1. fetch('dictionary.json')          ~80ms  (cached after first load)
   2. Spawn Worker via Blob URL
   3. Worker builds 172k-node tree      ~250ms (background thread — no UI freeze)
   4. Worker posts {type:'ready', root} — structured clone transfers tree
   5. worker.terminate()
   6. trie.root = e.data.root           O(1)  — hot-swap, no rebuild
   7. onReady(trie) — board renders

   Fallback: if Worker construction fails (e.g. strict CSP blocking
   Blob URLs), builds synchronously on main thread with a console warning.
   ========================================================== */

/**
 * Loads dictionary.json, builds the Trie in a Web Worker (truly
 * offloaded — no redundant main-thread rebuild), then calls onReady.
 *
 * @param {function(Trie): void} onReady - called once the Trie is ready
 */
function buildTrieAsync(onReady) {
  fetch('./dictionary.json')
    .then(r => {
      if (!r.ok) throw new Error(`dictionary.json fetch failed: ${r.status}`);
      return r.json();
    })
    .then(words => {

      /* --- Try Worker path first --- */
      let worker;
      try {
        const blob = new Blob([_workerSrc], { type: 'application/javascript' });
        const url  = URL.createObjectURL(blob);
        worker = new Worker(url);
        URL.revokeObjectURL(url); // revoke immediately — Worker holds its own ref
      } catch (_) {
        // Worker construction failed (e.g. CSP) — fall through to sync build
        worker = null;
      }

      if (worker) {
        worker.onmessage = function (e) {
          if (e.data.type !== 'ready') return;
          worker.terminate();

          // Hot-swap: assign the pre-built plain-object root.
          // search() and startsWith() work on plain objects — no rebuild needed.
          const trie = new Trie();
          trie.root = e.data.root;

          onReady(trie);
        };

        worker.onerror = function (err) {
          // Worker crashed mid-build — fall back to sync main-thread build
          console.warn('[WPB] Worker error, falling back to sync trie build:', err.message);
          worker.terminate();
          _buildSync(words, onReady);
        };

        worker.postMessage({ type: 'build', words });

      } else {
        // No Worker available — build synchronously
        _buildSync(words, onReady);
      }
    })
    .catch(err => {
      console.error('[WPB] Failed to load dictionary.json:', err.message);
      // Surface the error in the UI so it's obvious during development
      const el = document.getElementById('turn-badge');
      if (el) el.textContent = 'DICT ERROR';
    });
}

/**
 * Synchronous fallback — builds the trie on the main thread.
 * Only reached if Workers are unavailable (unusual CSP setups).
 * @param {string[]} words
 * @param {function(Trie): void} onReady
 */
function _buildSync(words, onReady) {
  console.warn('[WPB] Building trie synchronously — UI may stutter briefly.');
  const trie = new Trie();
  for (const w of words) trie.insert(w);
  onReady(trie);
}   * @returns {boolean}
   */
  search(word) {
    let n = this.root;
    for (const ch of word.toUpperCase()) {
      if (!n.children[ch]) return false;
      n = n.children[ch];
    }
    return n.isWord;
  }

  /**
   * Returns true if any word starts with prefix — used by Hard AI for pruning.
   * @param {string} prefix
   * @returns {boolean}
   */
  startsWith(prefix) {
    let n = this.root;
    for (const ch of prefix.toUpperCase()) {
      if (!n.children[ch]) return false;
      n = n.children[ch];
    }
    return true;
  }
}

/**
 * Fetches dictionary.json, builds a Trie on the main thread,
 * and calls onReady(trie) when complete.
 *
 * NOTE: Building ~170k words takes ~80–120ms on mobile.
 * The caller should show a loading state before calling this.
 * The previous Web Worker approach was a no-op (the worker's result
 * was never used — the main thread rebuilt the Trie anyway).
 * This version is honest about where work happens.
 *
 * @param {Function} onReady  — called with the completed Trie
 * @param {Function} [onError] — called if fetch or parse fails
 */
function buildTrieAsync(onReady, onError) {
  fetch('./dictionary.json')
    .then(r => {
      if (!r.ok) throw new Error(`dictionary.json fetch failed: ${r.status}`);
      return r.json();
    })
    .then(words => {
      // Build Trie. ~170k words × ~7 chars avg = ~1.2M iterations.
      // On a mid-range phone this runs in 80–120ms.
      const trie = new Trie();
      for (const w of words) {
        if (typeof w === 'string' && w.length >= 3 && w.length <= 10) {
          trie.insert(w);
        }
      }
      onReady(trie);
    })
    .catch(err => {
      console.error('[WPB] Trie build failed:', err);
      if (typeof onError === 'function') onError(err);
    });
}
