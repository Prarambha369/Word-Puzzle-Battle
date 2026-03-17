/**
 * Word Puzzle Battle — AI Bot
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * https://github.com/Prarambha369/Word-Puzzle-Battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */

'use strict';

/** @constant {number} - Maximum time budget for AI computation in milliseconds */
const AI_TIME_BUDGET_MS = 180;

/** @constant {Array<string>} - Top 10 most common English letters for Medium AI */
const MEDIUM_LETTERS = ['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S', 'L', 'C'];

/** @constant {Array<string>} - All 26 letters for Hard AI */
const ALL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Finds candidate empty cells near existing placed letters.
 * Returns cells within radius 2 of any letter on the board.
 * If board is empty (first move), returns center cluster.
 * @param {Array<Array<Object>>} board - The game board state
 * @returns {Array<Object>} - Array of candidate cell objects
 */
function findCandidateCells(board) {
  const nearSet = new Set();
  let hasAnyLetter = false;

  // Scan board for placed letters
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].letter) {
        hasAnyLetter = true;

        // Check all cells within radius 2
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr;
            const nc = c + dc;

            if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10) {
              if (!board[nr][nc].letter) {
                nearSet.add(`${nr},${nc}`);
              }
            }
          }
        }
      }
    }  }

  // First move: return center cells
  if (!hasAnyLetter) {
    return [
      board[4][4],
      board[4][5],
      board[5][4],
      board[5][5],
      board[4][3],
      board[3][4]
    ];
  }

  // Convert set to array of cell objects
  const candidates = [];
  for (const key of nearSet) {
    const [r, c] = key.split(',').map(Number);
    candidates.push(board[r][c]);
  }

  return candidates;
}

/**
 * Returns a random fallback move when no scoring move is found.
 * Used by all difficulty levels as a last resort.
 * @param {Array<Array<Object>>} board - The game board state
 * @returns {Object} - Move object with row, col, letter, score
 */
function randomFallback(board) {
  const emptyCells = [];

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (!board[r][c].letter) {
        emptyCells.push(board[r][c]);
      }
    }
  }

  if (emptyCells.length === 0) {
    return { row: -1, col: -1, letter: 'E', score: 0 };
  }

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const randomLetter = ALL_LETTERS[Math.floor(Math.random() * 26)];

  return {
    row: randomCell.row,    col: randomCell.col,
    letter: randomLetter,
    score: 0
  };
}

/**
 * Simulates placing a letter and calculates the resulting score.
 * Temporarily modifies board, evaluates, then undoes the change.
 * @param {Array<Array<Object>>} board - The game board state
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @param {string} letter - Letter to simulate placing
 * @param {Object} trie - Trie dictionary instance
 * @returns {number} - Score for this simulated move
 */
function evaluateMove(board, r, c, letter, trie) {
  // Temporarily place letter
  board[r][c].letter = letter;

  // Detect words formed by this placement
  let score = 0;
  if (typeof detectWords === 'function') {
    const words = detectWords(board, r, c, trie);
    for (const wordObj of words) {
      if (typeof scoreWord === 'function') {
        score += scoreWord(wordObj.word);
      }
    }
  }

  // Undo placement
  board[r][c].letter = null;

  return score;
}

/**
 * Easy AI: Random cell + random letter.
 * No evaluation, no scoring attempt. Instant move.
 * @param {Array<Array<Object>>} board - The game board state
 * @returns {Object} - Move object with row, col, letter
 */
function easyMove(board) {
  return randomFallback(board);
}

/**
 * Medium AI: Evaluates top 10 letters near existing tiles.
 * Picks the highest scoring move. Falls back to 'E' if no scoring move found. * @param {Array<Array<Object>>} board - The game board state
 * @param {Object} trie - Trie dictionary instance
 * @returns {Object} - Best move object with row, col, letter, score
 */
function mediumMove(board, trie) {
  const candidates = findCandidateCells(board);
  let bestMove = null;

  // Try each candidate cell with top 10 letters
  for (const cell of candidates) {
    for (const letter of MEDIUM_LETTERS) {
      const score = evaluateMove(board, cell.row, cell.col, letter, trie);

      if (!bestMove || score > bestMove.score) {
        bestMove = {
          row: cell.row,
          col: cell.col,
          letter: letter,
          score: score
        };
      }
    }
  }

  // Fallback: place 'E' at random candidate cell if no scoring move found
  if (!bestMove || bestMove.score === 0) {
    const randomCell = candidates[Math.floor(Math.random() * candidates.length)];
    if (randomCell) {
      return {
        row: randomCell.row,
        col: randomCell.col,
        letter: 'E',
        score: 0
      };
    }
    return randomFallback(board);
  }

  return bestMove;
}

/**
 * Hard AI: Evaluates all 26 letters with Trie prefix pruning.
 * Enforces strict 180ms time budget to prevent UI blocking.
 * Uses trie.startsWith() to eliminate dead-end sequences early.
 * @param {Array<Array<Object>>} board - The game board state
 * @param {Object} trie - Trie dictionary instance
 * @returns {Object} - Best move object with row, col, letter, score
 */
function hardMove(board, trie) {  const startTime = performance.now();
  const candidates = findCandidateCells(board);

  const directions = [
    [0, 1], [0, -1], [1, 0], [-1, 0],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];

  let bestMove = null;

  // Outer loop: iterate through candidate cells
  outerLoop:
  for (const cell of candidates) {
    // Inner loop: try all 26 letters
    for (const letter of ALL_LETTERS) {
      // Enforce time budget — critical for UX
      if (performance.now() - startTime > AI_TIME_BUDGET_MS) {
        break outerLoop;
      }

      // Temporarily place letter for evaluation
      board[cell.row][cell.col].letter = letter;

      // Use trie.startsWith() to prune dead sequences
      let hasPotential = false;

      for (const [dr, dc] of directions) {
        // Build sequence in forward direction
        let seq = letter;
        let r = cell.row + dr;
        let c = cell.col + dc;

        while (r >= 0 && r < 10 && c >= 0 && c < 10 && board[r][c].letter) {
          seq += board[r][c].letter;
          r += dr;
          c += dc;
        }

        // Check if forward sequence could form a word
        if (trie.startsWith(seq)) {
          hasPotential = true;
          break;
        }

        // Check backward sequence (reverse direction)
        const reversed = seq.split('').reverse().join('');
        if (trie.startsWith(reversed)) {
          hasPotential = true;
          break;
        }      }

      // Undo placement
      board[cell.row][cell.col].letter = null;

      // Skip this letter if it can't form valid words
      if (!hasPotential) continue;

      // Full evaluation for promising moves
      const score = evaluateMove(board, cell.row, cell.col, letter, trie);

      if (!bestMove || score > bestMove.score) {
        bestMove = {
          row: cell.row,
          col: cell.col,
          letter: letter,
          score: score
        };
      }
    }
  }

  // Always return a move — fallback if no scoring move found
  return bestMove || randomFallback(board);
}

/**
 * Main AI entry point. Always wrapped in setTimeout to prevent UI blocking.
 * Selects move based on difficulty level and calls callback with result.
 * @param {Array<Array<Object>>} board - The game board state
 * @param {Object} trie - Trie dictionary instance
 * @param {string} difficulty - AI difficulty: 'easy', 'medium', or 'hard'
 * @param {Function} callback - Callback function receiving the move object
 * @returns {void}
 */
function aiSelectMove(board, trie, difficulty, callback) {
  // Always wrap AI in setTimeout to not block UI paint
  setTimeout(() => {
    let move;

    if (difficulty === 'easy') {
      move = easyMove(board);
    } else if (difficulty === 'medium') {
      move = mediumMove(board, trie);
    } else {
      move = hardMove(board, trie);
    }

    callback(move);
  }, 0);}

// Export to window for game.js access
window.aiSelectMove = aiSelectMove;
window.AIBot = {
  aiSelectMove: aiSelectMove,
  easyMove: easyMove,
  mediumMove: mediumMove,
  hardMove: hardMove,
  findCandidateCells: findCandidateCells,
  randomFallback: randomFallback,
  evaluateMove: evaluateMove
};
