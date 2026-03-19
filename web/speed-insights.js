/**
 * Word Puzzle Battle - Speed Insights Integration
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */

import { injectSpeedInsights } from './node_modules/@vercel/speed-insights/dist/index.mjs';

// Initialize Vercel Speed Insights
injectSpeedInsights({
  debug: false,
  sampleRate: 1 // Track 100% of page loads
});
