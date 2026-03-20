# 🎮 Word Puzzle Battle

*A competitive turn-based word-building game for the web.*

[![License](https://img.shields.io/badge/License-WPB%20Source--Available-22c55e?style=flat-square)](LICENSE.md)
[![Status](https://img.shields.io/badge/Status-In%20Development-e8a838?style=flat-square)]()
[![Platform](https://img.shields.io/badge/Platform-Web%20%2B%20PWA-004643?style=flat-square)]()
[![Made with](https://img.shields.io/badge/Made%20with-Vanilla%20JS-f1e05a?style=flat-square)]()
[![Firebase](https://img.shields.io/badge/Backend-Firebase-FF6820?style=flat-square)]()

![Game Screenshot](assets/screenshot.png)

---

## Features

- 🎯 **First to 20 points wins.** Turn-based scoring with progressive difficulty.
- 🤖 **Offline AI opponents.** Easy, Medium, and Hard with 180ms move budget.
- 🌐 **Real-time multiplayer.** Play online via Firebase Realtime Database — no server required.
- 📱 **Installable PWA.** Works offline on mobile and desktop. Add to home screen.
- 🔤 **Eight-direction word detection.** Horizontal, vertical, and all four diagonals.
- ⚡ **Trie dictionary lookup.** O(k) performance, 100k+ English words (3–10 letters).
- 🎨 **Three themes.** Dark, Light, and Deep Forest — CSS custom properties throughout.
- 📦 **Zero frontend dependencies.** Pure vanilla HTML5, CSS3, and JavaScript.
- ♿ **Full accessibility.** WCAG AA, keyboard navigation, screen reader support.
- ☁️ **Cloud stats.** Sign in with Google to sync game history across devices.

---

## How to Play

1. **Place a letter.** Tap any empty cell on the shared 10×10 board and pick a letter A–Z.
2. **Form words.** Valid English words of 3+ letters score points — any direction.
3. **Earn points.** 3 letters = 1 pt · 4 letters = 2 pts · 5+ letters = 3 pts.
4. **Block your opponent.** Both players build on the same board — extend or hijack enemy words.
5. **Reach 20 points.** First to 20 wins. If the board fills first, highest score wins.
6. **Choose your opponent.** AI (Easy / Medium / Hard) or a real player online.

### Scoring

| Word | Length | Points |
|------|--------|--------|
| CAT  | 3 | 1 pt |
| WORD | 4 | 2 pts |
| BATTLE | 6 | 3 pts |
| Multiple words same turn | — | Each scores separately |

---

## Quick Start

### Play instantly (no install)

👉 **[wordpuzzlebattle.web.app](https://wordpuzzlebattle.web.app)**

### Run locally

```bash
git clone https://github.com/Prarambha369/Word-Puzzle-Battle.git
cd Word-Puzzle-Battle

# Serve the web folder (any static server works)
npx serve web

# Open: http://localhost:3000
```

No build step. No npm install. Open and play.

---

## Project Structure

```
Word-Puzzle-Battle/
├── firebase.json              ← Firebase Hosting config
├── .firebaserc                ← Firebase project link
├── .gitignore
├── README.md
├── LICENSE.md
└── web/
    ├── index.html             ← Game shell + PWA manifest link
    ├── style.css              ← Design tokens + all styles (3 themes)
    ├── game.js                ← Core game logic + DOM rendering
    ├── trie.js                ← Trie data structure + Web Worker build
    ├── ai-bot.js              ← Offline AI: Easy / Medium / Hard
    ├── profile.js             ← Local guest profile + stats
    ├── tutorial.js            ← 4-phase onboarding tutorial
    ├── tutorial.css           ← Tutorial styles
    ├── firebase-multiplayer.js← Firebase RTDB multiplayer (no server)
    ├── multiplayer.css        ← Lobby + VS screen styles
    ├── auth.js                ← Google Sign-In via Firebase Auth
    ├── auth.css               ← Auth screen styles
    ├── config.js              ← Firebase project config (safe to commit)
    ├── service-worker.js      ← PWA offline caching
    ├── manifest.json          ← PWA manifest
    ├── dictionary.json        ← 100k+ English words (3–10 letters)
    ├── privacy.html           ← Privacy Policy
    ├── terms.html             ← Terms of Service
    └── assets/
        └── icons/             ← PWA icons (72 → 512px + maskable)
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vanilla HTML5, CSS3, JavaScript | Game UI and logic — no frameworks |
| Dictionary | Trie + Web Worker | O(k) word validation, non-blocking |
| AI | Offline bot (180ms budget) | Easy / Medium / Hard — no API calls |
| Multiplayer | Firebase Realtime Database | Real-time sync — no Node server needed |
| Auth | Firebase Authentication | Google Sign-In, guest fallback |
| Hosting | Firebase Hosting / Vercel | Static deploy, free tier |
| PWA | manifest.json + service-worker | Installable, works offline |
| Design | CSS custom properties | 3 themes, zero hardcoded values |

---

## AI Difficulty Levels

| Level | Strategy | Letters Tried | Time Budget |
|-------|----------|--------------|-------------|
| Easy | Random cell + random letter | All 26 | None |
| Medium | Top 10 frequent letters near existing tiles | E A R I O T N S L C | 180ms |
| Hard | All 26 letters, Trie prefix pruning, exhaustive | All 26 | 180ms |

All moves complete within 180ms. The bot always returns a valid fallback if the budget expires.

---

## Firebase Setup (for multiplayer + auth)

The game uses Firebase on the free Spark plan — no credit card, free forever.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → create project `wordpuzzlebattle`
2. Build → Realtime Database → Create database → Start in test mode
3. Authentication → Sign-in method → Google → Enable
4. Project Settings → Your apps → Web app → copy config into `web/config.js`

Security rules (paste in Realtime Database → Rules):

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "rooms": {
      "$roomId": {
        ".read":  true,
        ".write": "auth !== null"
      }
    }
  }
}
```

---

## Deploy (no terminal needed)

### Vercel — easiest, auto-deploys on every push

1. [vercel.com](https://vercel.com) → sign up with GitHub
2. Import `Prarambha369/Word-Puzzle-Battle`
3. Set **Root Directory** to `web`
4. Deploy → live in ~60 seconds

### Firebase Hosting — via GitHub Actions

Add `.github/workflows/deploy.yml`, add `FIREBASE_SERVICE_ACCOUNT` secret to your repo. Every push to `main` auto-deploys to `wordpuzzlebattle.web.app`.

### Netlify — drag and drop

Download the `web/` folder and drag it to [app.netlify.com](https://app.netlify.com). Instant live URL.

---

## Multiplayer Room Codes

Rooms use tree-name codes like `OAK-77`, `ELM-44`, `ASH-12`. Rooms expire automatically after 40 minutes of inactivity. No sign-in required to host or join.

---

## Accessibility

- WCAG AA contrast ratios throughout
- Full keyboard navigation — Tab to tiles, Enter or Space to place
- Minimum 44×44px touch targets on all interactive elements
- `aria-label` on every board cell and interactive element
- Respects `prefers-reduced-motion`
- Screen reader announcements for turn changes and scores

---

## License

This project is released under the **Word Puzzle Battle Source-Available License v1.0**.

| Use | Allowed |
|-----|---------|
| Personal / hobby / education | ✅ Free |
| Non-commercial open-source forks | ✅ Free with attribution |
| Commercial use / SaaS / monetised apps | 💰 27% gross revenue royalty |
| Derivatives / modified versions | ✅ Allowed with mandatory attribution |

See [LICENSE.md](LICENSE.md) for full legal text.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

**Guidelines:** Keep it vanilla JS. Use CSS custom properties — no hardcoded values. All interactive elements must be keyboard accessible. Include the copyright header in every JS file.

---

## Author

**Prarambha Bashyal**

- GitHub: [@Prarambha369](https://github.com/Prarambha369)
- Email: [bashyal@ik.me](mailto:bashyal@ik.me)
- Game: [wordpuzzlebattle.web.app](https://wordpuzzlebattle.web.app)

---

## Support

- 🐛 Bug reports → [Open an Issue](https://github.com/Prarambha369/Word-Puzzle-Battle/issues)
- 💡 Feature requests → [Discussions](https://github.com/Prarambha369/Word-Puzzle-Battle/discussions)
- 📧 Licensing enquiries → [bashyal@ik.me](mailto:bashyal@ik.me)

---

*Made with care using vanilla JavaScript. No frameworks. No build tools. Pure web.*

*Last updated: March 2026 · Version: GROWTH v1.0.4*
