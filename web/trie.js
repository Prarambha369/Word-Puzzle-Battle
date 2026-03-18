/**
 * Word Puzzle Battle — Trie Dictionary
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * https://github.com/Prarambha369/Word-Puzzle-Battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

class TrieNode {
  constructor() {
    this.children = {};
    this.isWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  /**
   * Inserts a word into the Trie.
   * @param {string} word
   */
  insert(word) {
    let n = this.root;
    for (const ch of word.toUpperCase()) {
      if (!n.children[ch]) n.children[ch] = new TrieNode();
      n = n.children[ch];
    }
    n.isWord = true;
  }

  /**
   * Returns true if the exact word exists.
   * @param {string} word
   * @returns {boolean}
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
