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

const AI_TIME_BUDGET_MS = 180;
const MEDIUM_LETTERS    = ['E','A','R','I','O','T','N','S','L','C'];
const ALL_LETTERS       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Returns empty cells within radius 2 of any placed letter.
 * Falls back to center cluster on empty board.
 * @param {Array} board @returns {Array}
 */
function findCandidateCells(board) {
  const near = new Set();
  let hasAny = false;
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (board[r][c].letter) {
    hasAny = true;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && !board[nr][nc].letter)
        near.add(nr + ',' + nc);
    }
  }
  if (!hasAny) return [board[4][4], board[4][5], board[5][4], board[5][5], board[4][3], board[3][4]];
  return [...near].map(k => { const [r, c] = k.split(',').map(Number); return board[r][c]; });
}

/**
 * Random fallback move.
 * @param {Array} board @returns {{ row, col, letter }}
 */
function randomFallback(board) {
  const empty = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (!board[r][c].letter) empty.push(board[r][c]);
  const cell = empty[Math.floor(Math.random() * empty.length)];
  return { row: cell.row, col: cell.col, letter: ALL_LETTERS[Math.floor(Math.random() * 26)] };
}

/**
 * Temporarily places letter, scores result, undoes placement.
 * @param {Array} board @param {number} row @param {number} col
 * @param {string} letter @param {Object} trie @returns {number}
 */
function evaluateMove(board, row, col, letter, trie) {
  board[row][col].letter = letter;
  const words = detectWords(board, row, col, trie);
  let score = 0;
  for (const w of words) score += scoreWord(w.word);
  board[row][col].letter = null;
  return score;
}

/** Easy — completely random. @param {Array} board */
function easyMove(board) { return randomFallback(board); }

/**
 * Medium — tries top-10 letters near existing tiles.
 * @param {Array} board @param {Object} trie
 */
function mediumMove(board, trie) {
  const cands = findCandidateCells(board);
  let best = null;
  for (const cell of cands) for (const letter of MEDIUM_LETTERS) {
    const score = evaluateMove(board, cell.row, cell.col, letter, trie);
    if (!best || score > best.score) best = { row: cell.row, col: cell.col, letter, score };
  }
  if (!best || best.score === 0) {
    const cell = cands[Math.floor(Math.random() * cands.length)];
    return { row: cell.row, col: cell.col, letter: 'E' };
  }
  return best;
}

/**
 * Hard — all 26 letters, trie.startsWith pruning, 180ms budget.
 * @param {Array} board @param {Object} trie
 */
function hardMove(board, trie) {
  const start = performance.now();
  const cands = findCandidateCells(board);
  const dirs  = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  let best = null;

  outer:
  for (const cell of cands) {
    for (const letter of ALL_LETTERS) {
      if (performance.now() - start > AI_TIME_BUDGET_MS) break outer;
      board[cell.row][cell.col].letter = letter;
      let ok = false;
      for (const [dr, dc] of dirs) {
        let seq = letter, r = cell.row + dr, c = cell.col + dc;
        while (r >= 0 && r < 10 && c >= 0 && c < 10 && board[r][c].letter) {
          seq += board[r][c].letter; r += dr; c += dc;
        }
        if (trie.startsWith(seq) || trie.startsWith(seq.split('').reverse().join(''))) { ok = true; break; }
      }
      board[cell.row][cell.col].letter = null;
      if (!ok) continue;
      const score = evaluateMove(board, cell.row, cell.col, letter, trie);
      if (!best || score > best.score) best = { row: cell.row, col: cell.col, letter, score };
    }
  }
  return best || randomFallback(board);
}

/**
 * Public entry point — wraps AI in setTimeout to never block UI.
 * @param {Array} board @param {Object} trie
 * @param {string} difficulty @param {Function} callback
 */
function aiSelectMove(board, trie, difficulty, callback) {
  setTimeout(() => {
    let move;
    if (difficulty === 'easy')        move = easyMove(board);
    else if (difficulty === 'medium') move = mediumMove(board, trie);
    else                              move = hardMove(board, trie);
    callback(move);
  }, 0);
}
