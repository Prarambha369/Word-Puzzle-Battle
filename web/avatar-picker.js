/**
 * Word Puzzle Battle — Forest Avatar Picker
 * Copyright (c) 2026 Prarambha Bashyal. All rights reserved.
 * Source: https://github.com/Prarambha369/word-puzzle-battle
 * License: Word Puzzle Battle Source-Available License v1.0
 */
'use strict';

const AVATAR_PACKS = {
  plants:  { label:'Plants',  icon:'🌿', emojis:['🌿','🌱','🌲','🌳','🌴','🌵','🍀','🍃','🍂','🍁','🌾','🌺','🌻','🌹','🌸','🌷','🌼','💐','🪴','🪸'] },
  fruits:  { label:'Fruits',  icon:'🍎', emojis:['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍑','🍒','🥭','🍍','🥥','🫒','🥝','🍅','🍏','🍆'] },
  animals: { label:'Animals', icon:'🐾', emojis:['🦊','🐺','🦝','🦁','🐯','🐻','🐼','🦙','🦔','🦦','🐿','🦡','🦫','🦉','🦅','🦆','🐦','🦋','🐛','🐝'] },
  furries: { label:'Furries', icon:'🐉', emojis:['🐉','🦄','🧚','🧝','🧜','🦸','👾','🤖','🎃','👻','🧙','🧌','🦇','🐲','🔮','⚗️','🧿','🌙','⭐','🌟'] }
};

function selectDefaultAvatar(name) {
  const all = AVATAR_PACKS.plants.emojis;
  const idx = ((name || 'A').toUpperCase().charCodeAt(0) - 65) % all.length;
  return all[Math.max(0, idx)];
}

function openAvatarPicker(onSelect) {
  document.getElementById('avatar-picker-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'avatar-picker-modal';
  modal.className = 'modal-overlay';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-label','Choose your avatar');

  modal.innerHTML = `
    <div class="avatar-picker-card">
      <div class="avatar-picker-header">
        <h3 class="avatar-picker-title">CHOOSE YOUR AVATAR</h3>
        <button class="avatar-picker-close" id="avatar-close-btn" aria-label="Close">&#215;</button>
      </div>
      <div class="avatar-pack-tabs" role="tablist">
        ${Object.entries(AVATAR_PACKS).map(([k,p],i)=>`
          <button class="avatar-pack-tab${i===0?' avatar-pack-tab--active':''}"
                  data-pack="${k}" role="tab" aria-selected="${i===0}">
            ${p.icon} ${p.label}
          </button>`).join('')}
      </div>
      <div class="avatar-grid" id="avatar-grid" role="listbox" aria-label="Avatar options"></div>
      <button class="btn-primary" id="avatar-confirm-btn"
              style="font-family:'Space Mono',monospace;font-size:0.8rem;letter-spacing:0.1em">
        USE THIS AVATAR
      </button>
    </div>`;

  document.body.appendChild(modal);
  _injectAvatarStyles();

  let selected = null;

  function renderPack(packKey) {
    const grid = document.getElementById('avatar-grid');
    const frag = document.createDocumentFragment();
    AVATAR_PACKS[packKey].emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.className = 'avatar-option' + (emoji===selected?' avatar-option--selected':'');
      btn.textContent = emoji;
      btn.setAttribute('role','option');
      btn.setAttribute('aria-label',`Avatar ${emoji}`);
      btn.setAttribute('aria-selected', String(emoji===selected));
      btn.addEventListener('click', () => {
        selected = emoji;
        grid.querySelectorAll('.avatar-option').forEach(b => {
          b.classList.remove('avatar-option--selected');
          b.setAttribute('aria-selected','false');
        });
        btn.classList.add('avatar-option--selected');
        btn.setAttribute('aria-selected','true');
      });
      frag.appendChild(btn);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  modal.querySelectorAll('.avatar-pack-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      modal.querySelectorAll('.avatar-pack-tab').forEach(t => {
        t.classList.remove('avatar-pack-tab--active');
        t.setAttribute('aria-selected','false');
      });
      tab.classList.add('avatar-pack-tab--active');
      tab.setAttribute('aria-selected','true');
      renderPack(tab.dataset.pack);
    });
  });

  function close() { modal.remove(); }

  document.getElementById('avatar-confirm-btn').addEventListener('click', () => {
    const chosen = selected || AVATAR_PACKS.plants.emojis[0];
    close(); onSelect(chosen);
  });
  document.getElementById('avatar-close-btn').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target===modal) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key==='Escape') { close(); document.removeEventListener('keydown',esc); }
  });

  renderPack(Object.keys(AVATAR_PACKS)[0]);
}

function _injectAvatarStyles() {
  if (document.getElementById('wpb-avatar-styles')) return;
  const s = document.createElement('style');
  s.id = 'wpb-avatar-styles';
  s.textContent = `
    .avatar-picker-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:16px;padding:24px;max-width:480px;width:95vw;max-height:90vh;overflow-y:auto;animation:avSlideUp 360ms cubic-bezier(.4,0,.2,1) both}
    @keyframes avSlideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
    .avatar-picker-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
    .avatar-picker-title{font-family:'Space Mono',monospace;font-size:.7rem;font-weight:700;letter-spacing:.14em;color:var(--color-accent)}
    .avatar-picker-close{background:transparent;border:none;font-size:1.6rem;color:var(--color-text-muted);cursor:pointer;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;transition:background 120ms ease}
    .avatar-picker-close:hover{background:var(--color-surface-2);color:var(--color-text)}
    .avatar-pack-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px}
    .avatar-pack-tab{background:var(--color-surface-2);border:1.5px solid var(--color-border);border-radius:20px;padding:8px 14px;font-family:'Space Mono',monospace;font-size:.68rem;font-weight:700;color:var(--color-text-muted);cursor:pointer;transition:all 120ms ease}
    .avatar-pack-tab--active{background:var(--color-accent);color:var(--color-bg);border-color:var(--color-accent)}
    .avatar-pack-tab:hover:not(.avatar-pack-tab--active){background:var(--color-accent-dim);color:var(--color-accent)}
    .avatar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:10px;margin-bottom:20px;min-height:100px}
    .avatar-option{aspect-ratio:1;background:var(--color-surface-2);border:1.5px solid var(--color-border);border-radius:12px;font-size:1.8rem;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 120ms ease;min-height:44px}
    .avatar-option:hover{border-color:var(--color-accent);transform:scale(1.08)}
    .avatar-option--selected{border-color:var(--color-accent);box-shadow:0 0 0 2px var(--color-accent);background:var(--color-accent-dim)}
    @media(prefers-reduced-motion:reduce){.avatar-picker-card,.avatar-option{animation:none;transition:none}}
  `;
  document.head.appendChild(s);
}

window.openAvatarPicker    = openAvatarPicker;
window.selectDefaultAvatar = selectDefaultAvatar;
window.AVATAR_PACKS        = AVATAR_PACKS;
