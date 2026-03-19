/**
 * Word Puzzle Battle — Configuration Template
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 *
 * HOW TO SET UP:
 *   1. Copy this file:   cp config.example.js config.js
 *   2. Fill in your Firebase values from console.firebase.google.com
 *      Project Settings → Your apps → Web app → Config
 *   3. config.js is gitignored — safe to put real values there
 *
 * NOTE: Firebase apiKey is a PUBLIC identifier, not a secret.
 * Security is handled by Firebase Security Rules, not this key.
 */

window.WPB_CONFIG = {

  firebase: {
    apiKey:            "",   // from Firebase Console → Project Settings
    authDomain:        "",   // yourproject.firebaseapp.com
    databaseURL:       "",   // https://yourproject-default-rtdb.firebaseio.com
    projectId:         "",   // yourproject
    storageBucket:     "",   // yourproject.appspot.com
    messagingSenderId: "",   // numeric ID
    appId:             ""    // 1:xxx:web:xxx
  }

};
