/**
 * Word Puzzle Battle — Trie Dictionary
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * https://github.com/Prarambha369/Word-Puzzle-Battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */

'use strict';

/**
 * TrieNode class representing a single node in the Trie.
 * Each node contains children map and a flag indicating if it's a word end.
 */
class TrieNode {
  constructor() {
    /** @type {Object<string, TrieNode>} */
    this.children = {};
    /** @type {boolean} */
    this.isWord = false;
  }
}

/**
 * Trie data structure for efficient word lookup.
 * Supports insert, search, and prefix checking in O(k) time.
 */
class Trie {
  constructor() {
    /** @type {TrieNode} */
    this.root = new TrieNode();
  }

  /**
   * Inserts a word into the Trie.
   * @param {string} word - The word to insert
   * @returns {void}
   */
  insert(word) {
    let node = this.root;
    const upperWord = word.toUpperCase();
    for (const char of upperWord) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isWord = true;
  }

  /**   * Searches for an exact word match in the Trie.
   * @param {string} word - The word to search for
   * @returns {boolean} - True if word exists, false otherwise
   */
  search(word) {
    let node = this.root;
    const upperWord = word.toUpperCase();
    for (const char of upperWord) {
      if (!node.children[char]) {
        return false;
      }
      node = node.children[char];
    }
    return node.isWord;
  }

  /**
   * Checks if any word in the Trie starts with the given prefix.
   * @param {string} prefix - The prefix to check
   * @returns {boolean} - True if prefix exists, false otherwise
   */
  startsWith(prefix) {
    let node = this.root;
    const upperPrefix = prefix.toUpperCase();
    for (const char of upperPrefix) {
      if (!node.children[char]) {
        return false;
      }
      node = node.children[char];
    }
    return true;
  }
}

/**
 * Inline Web Worker source code for non-blocking Trie initialization.
 * This runs in a separate thread to prevent UI blocking during dictionary load.
 */
const WORKER_SOURCE = `
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
  insert(word) {
    let node = this.root;
    const upperWord = word.toUpperCase();
    for (const char of upperWord) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    node.isWord = true;
  }
}

self.onmessage = function(e) {
  if (e.data.type === 'build') {
    const trie = new Trie();
    const words = e.data.words;
    for (let i = 0; i < words.length; i++) {
      trie.insert(words[i]);
    }
    self.postMessage({ type: 'ready', count: words.length });
  }
};
`;

/**
 * Builds the Trie asynchronously using a Web Worker.
 * Fetches dictionary.json, constructs Trie in worker thread, then initializes main thread Trie.
 * @param {Function} onReady - Callback function called with ready Trie instance
 * @returns {void}
 */
function buildTrieAsync(onReady) {
  fetch('./dictionary.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load dictionary.json');
      }
      return response.json();
    })
    .then(words => {
      const blob = new Blob([WORKER_SOURCE], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      
      worker.postMessage({ type: 'build', words: words });
      
      worker.onmessage = function(e) {
        if (e.data.type === 'ready') {
          worker.terminate();
                    // Build main thread Trie for synchronous lookups during gameplay
          const trie = new Trie();
          for (let i = 0; i < words.length; i++) {
            trie.insert(words[i]);
          }
          
          console.log('🌿 Trie ready:', words.length, 'words loaded');
          onReady(trie);
        }
      };
      
      worker.onerror = function(err) {
        console.error('Worker error:', err);
        worker.terminate();
        // Fallback: build on main thread
        const trie = new Trie();
        for (let i = 0; i < words.length; i++) {
          trie.insert(words[i]);
        }
        onReady(trie);
      };
    })
    .catch(error => {
      console.error('Failed to build Trie:', error);
      // Fallback with empty Trie
      onReady(new Trie());
    });
}

// Export for module systems (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Trie, TrieNode, buildTrieAsync };
}
