(function () {
  'use strict';

  const DEFAULT_PIN = '1234';
  const BUG_MESSAGES = [
    'Bzz! Welcome to PoisonBug!',
    'Scroll down a little bit for prices! ↓',
    'Search at the top for your dream card!',
    'Every card has a real photo & sale price!',
    'Click "List a Card" if you are the owner! 🪲'
  ];

  const DEFAULT_GRADES = [
    'Gem Mint',
    'Mint',
    'Near Mint',
    'Lightly Played',
    'Moderately Played',
    'Heavily Played',
    'Damaged'
  ];

  const DEFAULT_FINISHES = [
    'Normal (Non-Foil)',
    'Holo Foil',
    'Reverse Holo',
    'Full Art Foil',
    'Textured / Special Illustration Foil',
    'Radiant / Sparkle Foil',
    'Gold / Hyper Foil'
  ];

  const THEME_PRESETS = {
    poisonbug: {
      name: 'PoisonBug Neon',
      colorPrimary: '#d946ef',
      colorAccent: '#4ade80',
      colorBg: '#0b0616',
      colorCard: '#1c1236',
      bugShellColor: '#9333ea',
      bugSpotsColor: '#4ade80'
    },
    charizard: {
      name: 'Charizard Flame',
      colorPrimary: '#f97316',
      colorAccent: '#facc15',
      colorBg: '#140705',
      colorCard: '#29100b',
      bugShellColor: '#ea580c',
      bugSpotsColor: '#facc15'
    },
    blastoise: {
      name: 'Blastoise Ocean',
      colorPrimary: '#38bdf8',
      colorAccent: '#2dd4bf',
      colorBg: '#040d1a',
      colorCard: '#0c1e38',
      bugShellColor: '#0284c7',
      bugSpotsColor: '#2dd4bf'
    },
    pikachu: {
      name: 'Pikachu Volt',
      colorPrimary: '#facc15',
      colorAccent: '#fb923c',
      colorBg: '#121004',
      colorCard: '#262109',
      bugShellColor: '#eab308',
      bugSpotsColor: '#ef4444'
    },
    mewtwo: {
      name: 'Mewtwo Psychic',
      colorPrimary: '#f472b6',
      colorAccent: '#c084fc',
      colorBg: '#0f0720',
      colorCard: '#231344',
      bugShellColor: '#ec4899',
      bugSpotsColor: '#a855f7'
    },
    rayquaza: {
      name: 'Rayquaza Emerald',
      colorPrimary: '#10b981',
      colorAccent: '#fbbf24',
      colorBg: '#04130d',
      colorCard: '#0a291d',
      bugShellColor: '#059669',
      bugSpotsColor: '#fbbf24'
    },
    umbreon: {
      name: 'Umbreon Moon',
      colorPrimary: '#eab308',
      colorAccent: '#60a5fa',
      colorBg: '#06080f',
      colorCard: '#111728',
      bugShellColor: '#1e293b',
      bugSpotsColor: '#eab308'
    },
    alabaster: {
      name: 'Collector Slate',
      colorPrimary: '#818cf8',
      colorAccent: '#34d399',
      colorBg: '#0f172a',
      colorCard: '#1e293b',
      bugShellColor: '#6366f1',
      bugSpotsColor: '#34d399'
    }
  };

  const DEFAULT_SHOP_CONFIG = {
    preset: 'poisonbug',
    colorPrimary: '#d946ef',
    colorAccent: '#4ade80',
    colorBg: '#0b0616',
    colorCard: '#1c1236',
    bgPattern: 'glow',
    fontStyle: 'modern',
    brandFirst: 'Poison',
    brandSecond: 'Bug',
    brandTag: 'CARDS',
    bugShellColor: '#9333ea',
    bugSpotsColor: '#4ade80',
    bugSize: 38,
    bugAnim: 'float',
    bugMessages: [...BUG_MESSAGES],
    gridDensity: 'standard',
    cardFrame: 'neon',
    cardRadius: 18,
    imageFit: 'contain',
    holoTilt: true,
    priceReveal: 'scroll',
    currency: '$',
    bannerEnabled: false,
    bannerText: '🔥 Free protective sleeve & toploader with every card!',
    heroMain: 'Find Your Next Favorite',
    heroHighlight: 'Trading Card',
    heroSub:
      'Every card is photographed and listed directly by the PoisonBug shop owner. Use the search bar above or scroll down a little bit to reveal all cards for sale and their prices!',
    showShowcase: true,
    sectionTitle: 'Cards For Sale',
    searchPlaceholder: 'Search for the card you want...',
    customGrades: [...DEFAULT_GRADES],
    customFinishes: [...DEFAULT_FINISHES]
  };

  // =========================================================
  // DUAL STORAGE ENGINE (Server API + IndexedDB Static Fallback)
  // =========================================================
  class IndexedDbBackend {
    constructor() {
      this.dbPromise = null;
      this.seedPromise = null;
    }

    open() {
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('poisonbug_store_v1', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('cards')) {
            db.createObjectStore('cards', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('orders')) {
            db.createObjectStore('orders', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this.dbPromise;
    }

    async idbGet(storeName, key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, 'readonly');
        const req = t.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async idbGetAll(storeName) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, 'readonly');
        const req = t.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    async idbPut(storeName, value) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, 'readwrite');
        t.objectStore(storeName).put(value);
        t.oncomplete = () => resolve(value);
        t.onerror = () => reject(t.error);
      });
    }

    async idbDelete(storeName, key) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, 'readwrite');
        t.objectStore(storeName).delete(key);
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    }

    ensureSeeded() {
      if (this.seedPromise) return this.seedPromise;
      this.seedPromise = (async () => {
        const clearedUnlisted = await this.idbGet('settings', 'cleared_unlisted_v3');
        if (!clearedUnlisted) {
          const existingPinRec = await this.idbGet('settings', 'owner_pin');
          const pinToKeep = existingPinRec && existingPinRec.value ? existingPinRec.value : DEFAULT_PIN;
          const allExisting = await this.idbGetAll('cards');
          const db = await this.open();
          await new Promise((resolve, reject) => {
            const t = db.transaction(['cards', 'settings'], 'readwrite');
            const cardStore = t.objectStore('cards');
            const setStore = t.objectStore('settings');
            for (const c of allExisting) {
              if (c.id && (c.id.startsWith('starter-') || c.id.startsWith('poke-'))) {
                cardStore.delete(c.id);
              }
            }
            setStore.put({ key: 'cleared_unlisted_v3', value: '1' });
            setStore.put({ key: 'owner_pin', value: pinToKeep });
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
          });
        }
      })().catch((err) => {
        this.seedPromise = null;
        throw err;
      });
      return this.seedPromise;
    }

    async getPin() {
      await this.ensureSeeded();
      const rec = await this.idbGet('settings', 'owner_pin');
      return rec && rec.value ? rec.value : DEFAULT_PIN;
    }

    async verifyPin(pin) {
      const actual = await this.getPin();
      return String(pin).trim() === String(actual).trim();
    }

    async changePin(currentPin, newPin) {
      const ok = await this.verifyPin(currentPin);
      if (!ok) throw new Error('Current PIN is incorrect.');
      await this.idbPut('settings', { key: 'owner_pin', value: String(newPin).trim() });
      return true;
    }

    async getCards() {
      await this.ensureSeeded();
      const all = await this.idbGetAll('cards');
      return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async createCard(pin, payload) {
      if (!(await this.verifyPin(pin))) throw new Error('Invalid Owner PIN.');
      if (!payload.grade) throw new Error('Card grade is required.');
      if (!payload.finish) throw new Error('Card foil / finish is required.');
      const card = {
        id: 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name: payload.name.trim(),
        price: Number(payload.price),
        grade: payload.grade.trim(),
        finish: payload.finish.trim(),
        description: (payload.description || '').trim(),
        imageData: payload.imageData,
        sold: false,
        soldAt: null,
        buyerName: null,
        createdAt: new Date().toISOString()
      };
      await this.idbPut('cards', card);
      return card;
    }

    async updateCard(pin, id, patch) {
      if (!(await this.verifyPin(pin))) throw new Error('Invalid Owner PIN.');
      const existing = await this.idbGet('cards', id);
      if (!existing) throw new Error('Card not found.');
      if (patch.name !== undefined && String(patch.name).trim()) existing.name = String(patch.name).trim();
      if (patch.price !== undefined) existing.price = Number(patch.price);
      if (patch.grade !== undefined && String(patch.grade).trim()) existing.grade = String(patch.grade).trim();
      if (patch.finish !== undefined && String(patch.finish).trim()) existing.finish = String(patch.finish).trim();
      if (patch.description !== undefined) existing.description = String(patch.description).trim();
      if (patch.imageData && String(patch.imageData).startsWith('data:image/')) {
        existing.imageData = String(patch.imageData);
      }
      if (patch.sold !== undefined) {
        existing.sold = Boolean(patch.sold);
        if (!existing.sold) {
          existing.soldAt = null;
          existing.buyerName = null;
        }
      }
      await this.idbPut('cards', existing);
      return existing;
    }

    async deleteCard(pin, id) {
      if (!(await this.verifyPin(pin))) throw new Error('Invalid Owner PIN.');
      await this.idbDelete('cards', id);
      return true;
    }

    async getConfig() {
      await this.ensureSeeded();
      const rec = await this.idbGet('settings', 'shop_config');
      if (rec && rec.value && typeof rec.value === 'object') {
        return rec.value;
      }
      return null;
    }

    async saveConfig(config) {
      await this.ensureSeeded();
      await this.idbPut('settings', { key: 'shop_config', value: config });
      return config;
    }

    async checkout({ cardIds, buyerName, buyerNote }) {
      await this.ensureSeeded();
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(['cards', 'orders'], 'readwrite');
        const cardStore = t.objectStore('cards');
        const orderStore = t.objectStore('orders');
        const items = [];
        let total = 0;
        let settled = false;

        const fail = (err) => {
          if (settled) return;
          settled = true;
          try { t.abort(); } catch (_) {}
          reject(err);
        };

        let pending = cardIds.length;
        if (pending === 0) {
          fail(new Error('Your cart is empty.'));
          return;
        }

        let createdOrder = null;

        cardIds.forEach((id) => {
          const g = cardStore.get(id);
          g.onsuccess = () => {
            if (settled) return;
            const card = g.result;
            if (!card) {
              fail(new Error('One of the cards is no longer listed.'));
              return;
            }
            if (card.sold) {
              fail(new Error(`"${card.name}" was already sold!`));
              return;
            }
            card.sold = true;
            card.soldAt = new Date().toISOString();
            card.buyerName = buyerName.trim();
            cardStore.put(card);
            items.push({ id: card.id, name: card.name, price: card.price });
            total += Number(card.price);

            pending -= 1;
            if (pending === 0) {
              createdOrder = {
                id: 'ord-' + Date.now(),
                buyerName: buyerName.trim(),
                buyerNote: (buyerNote || '').trim(),
                total: Number(total.toFixed(2)),
                items,
                createdAt: new Date().toISOString()
              };
              orderStore.put(createdOrder);
            }
          };
          g.onerror = () => fail(g.error || new Error('Failed reading card.'));
        });

        t.oncomplete = () => {
          if (!settled) {
            settled = true;
            resolve(createdOrder);
          }
        };
        t.onerror = () => fail(t.error || new Error('Checkout failed.'));
      });
    }

    async getOrders(pin) {
      if (!(await this.verifyPin(pin))) throw new Error('Invalid Owner PIN.');
      const all = await this.idbGetAll('orders');
      return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  class ServerApiBackend {
    async request(path, options = {}) {
      const res = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      return data;
    }

    async verifyPin(pin) {
      const data = await this.request('/api/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin })
      });
      return Boolean(data.valid);
    }

    async changePin(currentPin, newPin) {
      await this.request('/api/change-pin', {
        method: 'POST',
        body: JSON.stringify({ currentPin, newPin })
      });
      return true;
    }

    async getCards() {
      const data = await this.request('/api/cards');
      return data.cards || [];
    }

    async createCard(pin, payload) {
      const data = await this.request('/api/cards', {
        method: 'POST',
        headers: { 'x-owner-pin': pin },
        body: JSON.stringify(payload)
      });
      return data.card;
    }

    async updateCard(pin, id, patch) {
      const data = await this.request(`/api/cards/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'x-owner-pin': pin },
        body: JSON.stringify(patch)
      });
      return data.card;
    }

    async deleteCard(pin, id) {
      await this.request(`/api/cards/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-owner-pin': pin }
      });
      return true;
    }

    async checkout(payload) {
      const data = await this.request('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return data.order;
    }

    async getOrders(pin) {
      const data = await this.request('/api/orders', {
        headers: { 'x-owner-pin': pin }
      });
      return data.orders || [];
    }

    async getConfig() {
      const data = await this.request('/api/config').catch(() => ({ config: null }));
      return data.config || null;
    }

    async saveConfig(config) {
      await this.request('/api/config', {
        method: 'PUT',
        body: JSON.stringify({ config })
      }).catch(() => {});
      return config;
    }
  }

  let backendInitPromise = null;

  function getBackend() {
    if (state.backend) return Promise.resolve(state.backend);
    if (backendInitPromise) return backendInitPromise;
    backendInitPromise = (async () => {
      if (!window.location.hostname.endsWith('github.io')) {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 1500);
          const res = await fetch('/api/health', { signal: ctrl.signal });
          clearTimeout(timer);
          if (res.ok) {
            const json = await res.json();
            if (json && json.ok) {
              state.backend = new ServerApiBackend();
              return state.backend;
            }
          }
        } catch (_) {
          // Static hosting mode — fall back seamlessly to IndexedDB
        }
      }
      state.backend = new IndexedDbBackend();
      return state.backend;
    })();
    return backendInitPromise;
  }

  // =========================================================
  // APP STATE & SHOP CUSTOMIZATION ENGINE
  // =========================================================
  function loadLocalConfig() {
    try {
      const raw = localStorage.getItem('poisonbug_shop_config');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_SHOP_CONFIG,
            ...parsed,
            bugMessages:
              Array.isArray(parsed.bugMessages) && parsed.bugMessages.length > 0
                ? parsed.bugMessages
                : [...DEFAULT_SHOP_CONFIG.bugMessages],
            customGrades:
              Array.isArray(parsed.customGrades) && parsed.customGrades.length > 0
                ? parsed.customGrades
                : [...DEFAULT_SHOP_CONFIG.customGrades],
            customFinishes:
              Array.isArray(parsed.customFinishes) && parsed.customFinishes.length > 0
                ? parsed.customFinishes
                : [...DEFAULT_SHOP_CONFIG.customFinishes]
          };
        }
      }
    } catch (_) {}
    return {
      ...DEFAULT_SHOP_CONFIG,
      bugMessages: [...DEFAULT_SHOP_CONFIG.bugMessages],
      customGrades: [...DEFAULT_SHOP_CONFIG.customGrades],
      customFinishes: [...DEFAULT_SHOP_CONFIG.customFinishes]
    };
  }

  const state = {
    backend: null,
    cards: [],
    cartIds: JSON.parse(localStorage.getItem('poisonbug_cart') || '[]'),
    ownerPin: sessionStorage.getItem('poisonbug_owner_pin') || null,
    pendingOwnerAction: null,
    filter: 'available',
    sort: 'newest',
    searchQuery: '',
    uploadedImageData: '',
    editedCardImageData: '',
    bugMsgIndex: 0,
    hasScrolledPastHero: false,
    config: loadLocalConfig()
  };

  function formatPrice(num) {
    const val = Number(num) || 0;
    const sym = (state.config && state.config.currency) || '$';
    return sym + val.toFixed(2);
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#d946ef').replace('#', '');
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean.padEnd(6, '0');
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function shiftHexBrightness(hex, delta) {
    const clean = String(hex || '#1c1236').replace('#', '');
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean.padEnd(6, '0');
    const num = parseInt(full, 16);
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const r = clamp(((num >> 16) & 255) + delta);
    const g = clamp(((num >> 8) & 255) + delta);
    const b = clamp((num & 255) + delta);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  function populateGradeAndFinishSelects() {
    const grades = state.config.customGrades.length ? state.config.customGrades : DEFAULT_GRADES;
    const finishes = state.config.customFinishes.length ? state.config.customFinishes : DEFAULT_FINISHES;

    const listGradeSel = document.getElementById('card-grade-input');
    const listFinishSel = document.getElementById('card-finish-input');
    const editGradeSel = document.getElementById('edit-grade-input');
    const editFinishSel = document.getElementById('edit-finish-input');

    if (listGradeSel) {
      const cur = listGradeSel.value;
      listGradeSel.innerHTML =
        `<option value="" selected disabled>Select grade...</option>` +
        grades.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
      if (cur && grades.includes(cur)) listGradeSel.value = cur;
    }

    if (listFinishSel) {
      const cur = listFinishSel.value;
      listFinishSel.innerHTML =
        `<option value="" selected disabled>Select foil or normal...</option>` +
        finishes.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
      if (cur && finishes.includes(cur)) listFinishSel.value = cur;
    }

    if (editGradeSel) {
      const cur = editGradeSel.value;
      editGradeSel.innerHTML = grades
        .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
        .join('');
      if (cur) editGradeSel.value = cur;
    }

    if (editFinishSel) {
      const cur = editFinishSel.value;
      editFinishSel.innerHTML = finishes
        .map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`)
        .join('');
      if (cur) editFinishSel.value = cur;
    }
  }

  function applyShopConfig() {
    const cfg = state.config;
    const root = document.documentElement;

    // 1. Dynamic Palette Variables
    root.style.setProperty('--purple-neon', cfg.colorPrimary);
    root.style.setProperty('--purple-core', shiftHexBrightness(cfg.colorPrimary, -24));
    root.style.setProperty('--purple-bright', shiftHexBrightness(cfg.colorPrimary, 35));
    root.style.setProperty('--poison-green', cfg.colorAccent);
    root.style.setProperty('--poison-emerald', shiftHexBrightness(cfg.colorAccent, -28));
    root.style.setProperty('--bg-deep', cfg.colorBg);
    root.style.setProperty('--bg-surface', shiftHexBrightness(cfg.colorBg, 14));
    root.style.setProperty('--bg-card', cfg.colorCard);
    root.style.setProperty('--bg-elevated', shiftHexBrightness(cfg.colorCard, 18));
    root.style.setProperty('--border-subtle', hexToRgba(cfg.colorPrimary, 0.25));
    root.style.setProperty('--border-glow', hexToRgba(cfg.colorPrimary, 0.58));
    root.style.setProperty('--radius-lg', `${Number(cfg.cardRadius) || 18}px`);
    root.style.setProperty('--card-image-fit', cfg.imageFit || 'contain');

    // 2. Body Data Attributes for CSS Layout / Pattern / Typography / Frame
    document.body.dataset.bgPattern = cfg.bgPattern || 'glow';
    document.body.dataset.fontStyle = cfg.fontStyle || 'modern';
    document.body.dataset.bugAnim = cfg.bugAnim || 'float';
    document.body.dataset.gridDensity = cfg.gridDensity || 'standard';
    document.body.dataset.cardFrame = cfg.cardFrame || 'neon';
    document.body.dataset.holoTilt = cfg.holoTilt ? 'true' : 'false';

    // 3. Little Top Bug Mascot Customization
    const bugSvg = document.getElementById('top-bug-svg');
    if (bugSvg) {
      const sz = Number(cfg.bugSize) || 38;
      bugSvg.setAttribute('width', String(sz));
      bugSvg.setAttribute('height', String(sz));
    }
    const shell1 = document.getElementById('bug-shell-stop-1');
    const shell2 = document.getElementById('bug-shell-stop-2');
    const shell3 = document.getElementById('bug-shell-stop-3');
    const head1 = document.getElementById('bug-head-stop-1');
    const head2 = document.getElementById('bug-head-stop-2');
    if (shell1) shell1.setAttribute('stop-color', shiftHexBrightness(cfg.bugShellColor, 48));
    if (shell2) shell2.setAttribute('stop-color', cfg.bugShellColor);
    if (shell3) shell3.setAttribute('stop-color', shiftHexBrightness(cfg.bugShellColor, -48));
    if (head1) head1.setAttribute('stop-color', shiftHexBrightness(cfg.bugShellColor, -14));
    if (head2) head2.setAttribute('stop-color', shiftHexBrightness(cfg.bugShellColor, -65));

    const legs = document.getElementById('bug-legs-group');
    const ant = document.getElementById('bug-antennae-group');
    const shellBody = document.getElementById('bug-body-shell');
    if (legs) legs.setAttribute('stroke', shiftHexBrightness(cfg.bugShellColor, 38));
    if (ant) ant.setAttribute('stroke', shiftHexBrightness(cfg.bugShellColor, 52));
    if (shellBody) shellBody.setAttribute('stroke', shiftHexBrightness(cfg.bugShellColor, 60));

    document.querySelectorAll('.bug-spot-accent').forEach((el) => {
      el.setAttribute('fill', cfg.bugSpotsColor);
    });
    document.querySelectorAll('.bug-spot-secondary').forEach((el) => {
      el.setAttribute('fill', shiftHexBrightness(cfg.bugShellColor, 58));
    });

    const bugSpeech = document.getElementById('bug-speech');
    const msgs = cfg.bugMessages && cfg.bugMessages.length ? cfg.bugMessages : BUG_MESSAGES;
    if (bugSpeech) {
      bugSpeech.textContent = msgs[state.bugMsgIndex % msgs.length];
    }

    // 4. Shop Brand & Announcement Banner
    const brandFirst = document.getElementById('brand-first');
    const brandSecond = document.getElementById('brand-second');
    const brandTag = document.getElementById('brand-tag');
    if (brandFirst) brandFirst.textContent = cfg.brandFirst || 'Poison';
    if (brandSecond) brandSecond.textContent = cfg.brandSecond || 'Bug';
    if (brandTag) {
      brandTag.textContent = cfg.brandTag || '';
      brandTag.classList.toggle('hidden', !cfg.brandTag);
    }
    const fullShopName = `${cfg.brandFirst || ''}${cfg.brandSecond || ''}`.trim() || 'PoisonBug';
    document.title = `${fullShopName} — Collectible Card Shop`;
    const footerBrandStrong = document.querySelector('.footer-brand strong');
    if (footerBrandStrong) footerBrandStrong.textContent = fullShopName;

    const bannerEl = document.getElementById('announcement-banner');
    const bannerTxt = document.getElementById('announcement-banner-text');
    if (bannerEl && bannerTxt) {
      bannerTxt.textContent = cfg.bannerText || '';
      bannerEl.classList.toggle('hidden', !cfg.bannerEnabled || !cfg.bannerText.trim());
    }

    // 5. Hero & Marketplace Copy
    const heroMainEl = document.getElementById('hero-title-main');
    const heroHighEl = document.getElementById('hero-title-highlight');
    const heroSubEl = document.getElementById('hero-subtitle-text');
    const showcaseEl = document.getElementById('hero-showcase');
    const heroGridEl = document.getElementById('hero-content-grid');
    const secTitleEl = document.getElementById('section-title-text');
    const secEyebrowEl = document.getElementById('section-eyebrow-text');
    const searchInputEl = document.getElementById('search-input');

    if (heroMainEl) heroMainEl.textContent = cfg.heroMain || 'Find Your Next Favorite';
    if (heroHighEl) heroHighEl.textContent = cfg.heroHighlight || 'Trading Card';
    if (heroSubEl) heroSubEl.textContent = cfg.heroSub || '';
    if (showcaseEl) showcaseEl.classList.toggle('hidden', !cfg.showShowcase);
    if (heroGridEl) heroGridEl.classList.toggle('showcase-hidden', !cfg.showShowcase);
    if (secTitleEl) secTitleEl.textContent = cfg.sectionTitle || 'Cards For Sale';
    if (secEyebrowEl) secEyebrowEl.textContent = `${fullShopName.toUpperCase()} MARKETPLACE`;
    if (searchInputEl) searchInputEl.placeholder = cfg.searchPlaceholder || 'Search for the card you want...';

    // 6. Currency Symbols on Forms
    document.querySelectorAll('.currency-prefix').forEach((el) => {
      el.textContent = cfg.currency || '$';
    });

    populateGradeAndFinishSelects();
  }

  let saveConfigTimeout = null;
  function persistShopConfig() {
    localStorage.setItem('poisonbug_shop_config', JSON.stringify(state.config));
    clearTimeout(saveConfigTimeout);
    saveConfigTimeout = setTimeout(async () => {
      try {
        const backend = await getBackend();
        if (backend && backend.saveConfig) {
          await backend.saveConfig(state.config);
        }
      } catch (_) {}
    }, 250);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3200);
  }

  function saveCart() {
    localStorage.setItem('poisonbug_cart', JSON.stringify(state.cartIds));
    updateCartBadge();
  }

  // =========================================================
  // IMAGE COMPRESSION FOR FAST PHOTO UPLOADS
  // =========================================================
  function compressImageFile(file, maxDim = 860, quality = 0.84) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Please choose a valid image file.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read image file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image format.'));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          let out = canvas.toDataURL('image/webp', quality);
          if (!out.startsWith('data:image/webp')) {
            out = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(out);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // =========================================================
  // RENDERING: HERO, CARDS GRID, SCROLL PRICE REVEAL, CART
  // =========================================================
  let priceObserver = null;

  function setupPriceScrollObserver() {
    if (priceObserver) priceObserver.disconnect();
    if (state.config && state.config.priceReveal === 'always') {
      document.querySelectorAll('#cards-grid .card-price-row').forEach((row) => {
        row.classList.add('revealed');
      });
      return;
    }

    priceObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
    );

    document.querySelectorAll('#cards-grid .card-price-row').forEach((row) => {
      // Reveal once user scrolls down a bit OR when card enters view below the fold
      if (window.scrollY > 60) {
        row.classList.add('revealed');
      } else {
        priceObserver.observe(row);
      }
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY > 55 && !state.hasScrolledPastHero) {
        state.hasScrolledPastHero = true;
        document.querySelectorAll('#cards-grid .card-price-row').forEach((row) => {
          row.classList.add('revealed');
        });
      }
    },
    { passive: true }
  );

  function renderHeroStatsAndShowcase() {
    const available = state.cards.filter((c) => !c.sold);
    const countEl = document.getElementById('hero-available-count');
    if (available.length === 0) {
      countEl.textContent = 'No cards listed yet — Owner listings appear here!';
    } else if (available.length === 1) {
      countEl.textContent = '1 Card Listed For Sale Now';
    } else {
      countEl.textContent = `${available.length} Cards Listed For Sale`;
    }

    const stack = document.getElementById('showcase-stack');
    const showcaseCards = available.slice(0, 3);
    if (showcaseCards.length === 0) {
      stack.innerHTML = `<div class="showcase-mini-card" style="display:grid;place-items:center;padding:18px;text-align:center;color:#d8b4fe;font-weight:700;line-height:1.45;"><div><div style="font-size:2rem;margin-bottom:8px;">🃏</div>No cards listed yet<br/><span style="font-size:0.78rem;color:#9e8cc4;font-weight:600;">Click "List a Card" to add your first card!</span></div></div>`;
      return;
    }
    stack.innerHTML = showcaseCards
      .map(
        (c) => `
      <div class="showcase-mini-card">
        <img src="${c.imageData}" alt="${escapeHtml(c.name)}" />
      </div>
    `
      )
      .join('');
  }

  function getCardGrade(card) {
    return card.grade || card.rarity || 'Near Mint';
  }

  function getCardFinish(card) {
    return card.finish || 'Holo Foil';
  }

  function isFoilFinish(finish) {
    return Boolean(finish && !/normal|non-foil|non-holo/i.test(finish));
  }

  function formatFinishText(finish) {
    if (!finish) return '🃏 Finish';
    return (isFoilFinish(finish) ? '✨ ' : '🃏 ') + finish;
  }

  function getFilteredSortedCards() {
    const q = state.searchQuery.trim().toLowerCase();
    let list = state.cards.filter((card) => {
      if (state.filter === 'available' && card.sold) return false;
      if (state.filter === 'sold' && !card.sold) return false;
      if (q) {
        const hay = `${card.name} ${getCardGrade(card)} ${getCardFinish(card)} ${card.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    if (state.sort === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (state.sort === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (state.sort === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }

  function renderCards() {
    renderHeroStatsAndShowcase();

    const grid = document.getElementById('cards-grid');
    const emptyState = document.getElementById('empty-state');
    const emptyTitle = document.getElementById('empty-title');
    const emptySubtitle = document.getElementById('empty-subtitle');
    const emptyResetBtn = document.getElementById('empty-reset-btn');
    const searchBanner = document.getElementById('search-status-banner');
    const searchText = document.getElementById('search-status-text');

    const filtered = getFilteredSortedCards();
    const isOwner = Boolean(state.ownerPin);

    if (state.searchQuery.trim()) {
      searchBanner.classList.remove('hidden');
      searchText.textContent = `Showing ${filtered.length} result${filtered.length === 1 ? '' : 's'} for "${state.searchQuery.trim()}"`;
    } else {
      searchBanner.classList.add('hidden');
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (state.cards.length === 0) {
        emptyTitle.textContent = 'No cards for sale right now';
        emptySubtitle.textContent = 'Cards will appear here as soon as the shop owner lists them!';
        emptyResetBtn.classList.add('hidden');
      } else if (state.filter === 'available' && !state.searchQuery.trim()) {
        emptyTitle.textContent = 'All listed cards have sold out!';
        emptySubtitle.textContent = 'Check the Sold tab or wait for the owner to list new cards.';
        emptyResetBtn.classList.remove('hidden');
      } else {
        emptyTitle.textContent = 'No matching cards found';
        emptySubtitle.textContent = 'Try searching for another card name or clearing your filters.';
        emptyResetBtn.classList.remove('hidden');
      }
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = filtered
      .map((card) => {
        const inCart = state.cartIds.includes(card.id);
        const grade = getCardGrade(card);
        const finish = getCardFinish(card);
        const foilClass = isFoilFinish(finish) ? 'is-foil' : '';
        const revealImmediately =
          (state.config && state.config.priceReveal === 'always') ||
          state.hasScrolledPastHero ||
          window.scrollY > 55 ||
          Boolean(state.searchQuery.trim());
        return `
        <article class="trading-card ${card.sold ? 'is-sold' : ''}" data-card-id="${escapeHtml(card.id)}">
          <div class="card-image-frame" data-action="zoom" data-id="${escapeHtml(card.id)}">
            <img src="${card.imageData}" alt="${escapeHtml(card.name)}" loading="lazy" />
            <span class="rarity-badge">${escapeHtml(grade)}</span>
            ${
              card.sold
                ? `<div class="sold-ribbon"><span class="sold-stamp">SOLD</span></div>`
                : ''
            }
          </div>
          <div class="card-body">
            <div class="card-meta-tags">
              <span class="finish-pill ${foilClass}">${escapeHtml(formatFinishText(finish))}</span>
            </div>
            <h3 class="card-title">${escapeHtml(card.name)}</h3>
            <p class="card-desc">${escapeHtml(card.description || 'Authentic owner-listed Pokémon card.')}</p>

            <div class="card-price-row ${revealImmediately ? 'revealed' : ''}">
              <div class="price-tag">
                <span class="price-caption">${card.sold ? 'SOLD FOR' : 'SALE PRICE'}</span>
                <span class="price-value">${formatPrice(card.price)}</span>
              </div>

              ${
                card.sold
                  ? `<span style="font-size:0.8rem;font-weight:800;color:#fda4af;">Sold Out</span>`
                  : `
                <div class="card-actions">
                  <button type="button" class="btn-cart-add ${inCart ? 'in-cart' : ''}" data-action="toggle-cart" data-id="${escapeHtml(card.id)}">
                    ${inCart ? '✓ In Cart' : '+ Cart'}
                  </button>
                  <button type="button" class="btn-buy-card" data-action="buy-now" data-id="${escapeHtml(card.id)}">
                    Buy
                  </button>
                </div>
              `
              }
            </div>

            ${
              isOwner
                ? `
              <div class="card-owner-tools">
                <button type="button" class="owner-mini-btn" data-action="edit-price" data-id="${escapeHtml(card.id)}">✏️ Edit</button>
                ${
                  card.sold
                    ? `<button type="button" class="owner-mini-btn" data-action="relist" data-id="${escapeHtml(card.id)}">↺ Relist</button>`
                    : ''
                }
                <button type="button" class="owner-mini-btn danger" data-action="delete-card" data-id="${escapeHtml(card.id)}">🗑️ Delete</button>
              </div>
            `
                : ''
            }
          </div>
        </article>
      `;
      })
      .join('');

    setupPriceScrollObserver();
  }

  function sanitizeCart() {
    const validAvailableIds = new Set(state.cards.filter((c) => !c.sold).map((c) => c.id));
    const cleaned = state.cartIds.filter((id) => validAvailableIds.has(id));
    if (cleaned.length !== state.cartIds.length) {
      state.cartIds = cleaned;
      saveCart();
    } else {
      updateCartBadge();
    }
  }

  function updateCartBadge() {
    document.getElementById('cart-count-badge').textContent = String(state.cartIds.length);
  }

  function renderCartDrawer() {
    sanitizeCart();
    const container = document.getElementById('cart-items-container');
    const footer = document.getElementById('cart-footer');
    const totalEl = document.getElementById('cart-total-amount');

    const cartCards = state.cartIds
      .map((id) => state.cards.find((c) => c.id === id && !c.sold))
      .filter(Boolean);

    if (cartCards.length === 0) {
      container.innerHTML = `
        <div class="cart-empty-msg">
          <div style="font-size:2.4rem;margin-bottom:8px;">🛒</div>
          <strong>Your cart is empty</strong>
          <p style="font-size:0.88rem;margin-top:6px;">Scroll down to browse cards for sale and click "Buy" or "+ Cart"!</p>
        </div>
      `;
      footer.classList.add('hidden');
      return;
    }

    footer.classList.remove('hidden');
    let sum = 0;
    container.innerHTML = cartCards
      .map((c) => {
        sum += Number(c.price);
        return `
        <div class="cart-item">
          <img src="${c.imageData}" alt="${escapeHtml(c.name)}" />
          <div class="cart-item-info">
            <div class="cart-item-title">${escapeHtml(c.name)}</div>
            <div class="cart-item-price">${formatPrice(c.price)}</div>
          </div>
          <button type="button" class="cart-remove-btn" data-remove-cart="${escapeHtml(c.id)}" aria-label="Remove from cart">✕</button>
        </div>
      `;
      })
      .join('');

    totalEl.textContent = formatPrice(sum);
    document.getElementById('checkout-submit-btn').textContent = `Buy ${cartCards.length} Card${cartCards.length > 1 ? 's' : ''} — ${formatPrice(sum)}`;
  }

  // =========================================================
  // MODALS & OWNER MODE HELPERS
  // =========================================================
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  function openCart() {
    renderCartDrawer();
    document.getElementById('cart-backdrop').classList.remove('hidden');
    document.getElementById('cart-drawer').classList.remove('hidden');
  }

  function closeCart() {
    document.getElementById('cart-backdrop').classList.add('hidden');
    document.getElementById('cart-drawer').classList.add('hidden');
  }

  function updateOwnerUi() {
    const isUnlocked = Boolean(state.ownerPin);
    const ownerBar = document.getElementById('owner-bar');
    const listBtn = document.getElementById('list-card-btn');
    const lockIcon = document.getElementById('owner-lock-icon');

    if (isUnlocked) {
      ownerBar.classList.remove('hidden');
      listBtn.classList.add('unlocked');
      lockIcon.textContent = '🔓';
    } else {
      ownerBar.classList.add('hidden');
      listBtn.classList.remove('unlocked');
      lockIcon.textContent = '🔒';
    }
    renderCards();
  }

  function requireOwnerThen(callback) {
    if (state.ownerPin) {
      callback();
      return;
    }
    state.pendingOwnerAction = callback;
    document.getElementById('owner-pin-input').value = '';
    document.getElementById('pin-error').classList.add('hidden');
    openModal('pin-modal');
    setTimeout(() => document.getElementById('owner-pin-input').focus(), 60);
  }

  function resetListCardForm() {
    document.getElementById('list-card-form').reset();
    document.getElementById('card-grade-input').value = '';
    document.getElementById('card-finish-input').value = '';
    document.getElementById('card-grade-input').classList.remove('input-invalid');
    document.getElementById('card-finish-input').classList.remove('input-invalid');
    state.uploadedImageData = '';
    document.getElementById('upload-placeholder').classList.remove('hidden');
    document.getElementById('upload-selected').classList.add('hidden');
    document.getElementById('image-upload-error').classList.add('hidden');
    document.getElementById('grade-error').classList.add('hidden');
    document.getElementById('finish-error').classList.add('hidden');
    document.getElementById('list-form-error').classList.add('hidden');
    document.getElementById('preview-img').src = '';
    document.getElementById('preview-img').classList.add('hidden');
    document.getElementById('preview-empty-art').classList.remove('hidden');
    document.getElementById('preview-name').textContent = 'Your Card Name';
    document.getElementById('preview-desc').textContent = 'Card details will appear here.';
    document.getElementById('preview-grade').textContent = 'Grade?';
    const prevFinish = document.getElementById('preview-finish');
    prevFinish.textContent = 'Foil / Normal?';
    prevFinish.classList.remove('is-foil');
    document.getElementById('preview-price').textContent = '$0.00';
  }

  function openListCardModal() {
    requireOwnerThen(() => {
      resetListCardForm();
      openModal('list-modal');
    });
  }

  function openZoomModal(cardId) {
    const card = state.cards.find((c) => c.id === cardId);
    if (!card) return;
    const grade = getCardGrade(card);
    const finish = getCardFinish(card);
    document.getElementById('zoom-card-img').src = card.imageData;
    document.getElementById('zoom-card-img').alt = card.name;
    document.getElementById('zoom-card-grade').textContent = grade;
    const zoomFinishEl = document.getElementById('zoom-card-finish');
    zoomFinishEl.textContent = formatFinishText(finish);
    zoomFinishEl.classList.toggle('is-foil', isFoilFinish(finish));
    document.getElementById('zoom-card-title').textContent = card.name;
    document.getElementById('zoom-card-desc').textContent =
      card.description || 'Authentic owner-listed Pokémon card.';
    document.getElementById('zoom-card-price').textContent = formatPrice(card.price);

    const actionArea = document.getElementById('zoom-action-area');
    if (card.sold) {
      actionArea.innerHTML = `<div class="sold-stamp" style="display:inline-block;transform:none;font-size:1rem;">SOLD OUT</div>`;
    } else {
      actionArea.innerHTML = `
        <button type="button" class="btn btn-primary btn-full" id="zoom-buy-btn">
          Buy Now for ${formatPrice(card.price)}
        </button>
      `;
      document.getElementById('zoom-buy-btn').addEventListener('click', () => {
        closeModal('zoom-modal');
        if (!state.cartIds.includes(card.id)) {
          state.cartIds.push(card.id);
          saveCart();
          renderCards();
        }
        openCart();
      });
    }

    openModal('zoom-modal');
  }

  // =========================================================
  // CUSTOMIZER STUDIO UI & HELPERS
  // =========================================================
  function openCustomizer() {
    syncCustomizerInputsFromState();
    document.getElementById('customizer-backdrop').classList.remove('hidden');
    document.getElementById('customizer-drawer').classList.remove('hidden');
  }

  function closeCustomizer() {
    document.getElementById('customizer-backdrop').classList.add('hidden');
    document.getElementById('customizer-drawer').classList.add('hidden');
  }

  function renderThemePresets() {
    const grid = document.getElementById('theme-presets-grid');
    if (!grid) return;
    grid.innerHTML = Object.entries(THEME_PRESETS)
      .map(([key, p]) => {
        const active = state.config.preset === key ? 'active' : '';
        return `
        <button type="button" class="preset-btn ${active}" data-preset-key="${escapeHtml(key)}">
          <span class="preset-swatches">
            <span class="preset-dot" style="background:${escapeHtml(p.colorPrimary)}"></span>
            <span class="preset-dot" style="background:${escapeHtml(p.colorAccent)}"></span>
            <span class="preset-dot" style="background:${escapeHtml(p.colorBg)}"></span>
          </span>
          <span>${escapeHtml(p.name)}</span>
        </button>
      `;
      })
      .join('');
  }

  function renderTagChips() {
    const gradesList = document.getElementById('cust-grades-list');
    const finishesList = document.getElementById('cust-finishes-list');

    if (gradesList) {
      gradesList.innerHTML = state.config.customGrades
        .map(
          (g, idx) => `
        <span class="tag-chip">
          <span>${escapeHtml(g)}</span>
          <button type="button" data-remove-grade="${idx}" aria-label="Remove grade">✕</button>
        </span>
      `
        )
        .join('');
    }

    if (finishesList) {
      finishesList.innerHTML = state.config.customFinishes
        .map(
          (f, idx) => `
        <span class="tag-chip">
          <span>${escapeHtml(f)}</span>
          <button type="button" data-remove-finish="${idx}" aria-label="Remove finish">✕</button>
        </span>
      `
        )
        .join('');
    }
  }

  function syncCustomizerInputsFromState() {
    const cfg = state.config;
    renderThemePresets();
    renderTagChips();

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setCheck = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(val);
    };

    setVal('cust-color-primary', cfg.colorPrimary);
    setVal('cust-color-accent', cfg.colorAccent);
    setVal('cust-color-bg', cfg.colorBg);
    setVal('cust-color-card', cfg.colorCard);
    setVal('cust-bg-pattern', cfg.bgPattern);
    setVal('cust-font-style', cfg.fontStyle);

    setVal('cust-brand-first', cfg.brandFirst);
    setVal('cust-brand-second', cfg.brandSecond);
    setVal('cust-brand-tag', cfg.brandTag);
    setVal('cust-bug-shell', cfg.bugShellColor);
    setVal('cust-bug-spots', cfg.bugSpotsColor);
    setVal('cust-bug-size', cfg.bugSize);
    const bugSzLabel = document.getElementById('cust-bug-size-val');
    if (bugSzLabel) bugSzLabel.textContent = `${cfg.bugSize}px`;
    setVal('cust-bug-anim', cfg.bugAnim);
    setVal('cust-bug-messages', (cfg.bugMessages || BUG_MESSAGES).join('\n'));

    setVal('cust-grid-density', cfg.gridDensity);
    setVal('cust-card-frame', cfg.cardFrame);
    setVal('cust-card-radius', cfg.cardRadius);
    const radLabel = document.getElementById('cust-card-radius-val');
    if (radLabel) radLabel.textContent = `${cfg.cardRadius}px`;
    setVal('cust-image-fit', cfg.imageFit);
    setCheck('cust-holo-tilt', cfg.holoTilt);
    setVal('cust-price-reveal', cfg.priceReveal);
    setVal('cust-currency', cfg.currency);

    setCheck('cust-banner-enabled', cfg.bannerEnabled);
    setVal('cust-banner-text', cfg.bannerText);
    setVal('cust-hero-main', cfg.heroMain);
    setVal('cust-hero-highlight', cfg.heroHighlight);
    setVal('cust-hero-sub', cfg.heroSub);
    setCheck('cust-show-showcase', cfg.showShowcase);
    setVal('cust-section-title', cfg.sectionTitle);
    setVal('cust-search-placeholder', cfg.searchPlaceholder);
  }

  function updateConfigField(patch, rerenderCardsNeeded = false) {
    Object.assign(state.config, patch);
    applyShopConfig();
    persistShopConfig();
    if (rerenderCardsNeeded) {
      renderCards();
    }
  }

  // =========================================================
  // EVENT LISTENERS
  // =========================================================
  function bindEvents() {
    // 1. Little Purple Bug at the very very top!
    const bugBtn = document.getElementById('purple-bug-btn');
    const bugSpeech = document.getElementById('bug-speech');
    bugBtn.addEventListener('click', () => {
      bugBtn.classList.remove('bug-hop');
      void bugBtn.offsetWidth;
      bugBtn.classList.add('bug-hop');
      const msgs =
        state.config.bugMessages && state.config.bugMessages.length
          ? state.config.bugMessages
          : BUG_MESSAGES;
      state.bugMsgIndex = (state.bugMsgIndex + 1) % msgs.length;
      bugSpeech.textContent = msgs[state.bugMsgIndex];
    });

    // 2. Top Search Bar
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', () => {
      state.searchQuery = searchInput.value;
      clearSearchBtn.classList.toggle('hidden', !state.searchQuery);

      // If searching for a card that happens to be sold while filter is "available", show all if 0 available matches
      renderCards();

      if (state.searchQuery.trim() && window.scrollY < 160) {
        const cardsSection = document.getElementById('cards-section');
        const y = cardsSection.getBoundingClientRect().top + window.scrollY - 115;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    });

    const resetSearchAndFilters = () => {
      state.searchQuery = '';
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      state.filter = 'available';
      document.querySelectorAll('.filter-pill').forEach((b) => {
        b.classList.toggle('active', b.dataset.filter === 'available');
      });
      renderCards();
    };

    clearSearchBtn.addEventListener('click', () => {
      state.searchQuery = '';
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      renderCards();
      searchInput.focus();
    });

    document.getElementById('reset-search-link').addEventListener('click', resetSearchAndFilters);
    document.getElementById('empty-reset-btn').addEventListener('click', resetSearchAndFilters);

    // 3. Filter Pills & Sort
    document.querySelectorAll('.filter-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        state.filter = pill.dataset.filter;
        document.querySelectorAll('.filter-pill').forEach((b) => b.classList.remove('active'));
        pill.classList.add('active');
        renderCards();
      });
    });

    document.getElementById('sort-select').addEventListener('change', (e) => {
      state.sort = e.target.value;
      renderCards();
    });

    // 4. List a Card & Owner Mode Buttons
    document.getElementById('list-card-btn').addEventListener('click', openListCardModal);
    document.getElementById('hero-list-btn').addEventListener('click', openListCardModal);
    document.getElementById('empty-list-btn').addEventListener('click', openListCardModal);

    document.getElementById('owner-lock-btn').addEventListener('click', () => {
      state.ownerPin = null;
      sessionStorage.removeItem('poisonbug_owner_pin');
      updateOwnerUi();
      showToast('🔒 Owner Mode locked.');
    });

    // PIN Unlock Form
    document.getElementById('pin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pinVal = document.getElementById('owner-pin-input').value.trim();
      const errEl = document.getElementById('pin-error');
      errEl.classList.add('hidden');
      try {
        const backend = await getBackend();
        const ok = await backend.verifyPin(pinVal);
        if (!ok) {
          errEl.textContent = 'Incorrect PIN. Try again!';
          errEl.classList.remove('hidden');
          return;
        }
        state.ownerPin = pinVal;
        sessionStorage.setItem('poisonbug_owner_pin', pinVal);
        closeModal('pin-modal');
        updateOwnerUi();
        showToast('🔓 Owner Mode unlocked!');
        if (state.pendingOwnerAction) {
          const fn = state.pendingOwnerAction;
          state.pendingOwnerAction = null;
          fn();
        }
      } catch (err) {
        errEl.textContent = err.message || 'Could not verify PIN.';
        errEl.classList.remove('hidden');
      }
    });

    // Change PIN Modal
    document.getElementById('owner-change-pin-btn').addEventListener('click', () => {
      document.getElementById('new-pin-input').value = '';
      document.getElementById('change-pin-error').classList.add('hidden');
      openModal('change-pin-modal');
    });

    document.getElementById('change-pin-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const newPin = document.getElementById('new-pin-input').value.trim();
      const errEl = document.getElementById('change-pin-error');
      if (newPin.length < 4) {
        errEl.textContent = 'PIN must be at least 4 characters.';
        errEl.classList.remove('hidden');
        return;
      }
      try {
        const backend = await getBackend();
        await backend.changePin(state.ownerPin, newPin);
        state.ownerPin = newPin;
        sessionStorage.setItem('poisonbug_owner_pin', newPin);
        closeModal('change-pin-modal');
        showToast('🔑 Owner PIN updated!');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    });

    // Owner Orders & Earnings Modal
    document.getElementById('owner-orders-btn').addEventListener('click', async () => {
      try {
        const backend = await getBackend();
        const orders = await backend.getOrders(state.ownerPin);
        const totalEarned = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);
        document.getElementById('orders-total-earned').textContent = formatPrice(totalEarned);
        document.getElementById('orders-total-count').textContent = String(orders.length);

        const listEl = document.getElementById('orders-list');
        if (orders.length === 0) {
          listEl.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:24px 0;">No completed orders yet. Share your PoisonBug link to start selling!</p>`;
        } else {
          listEl.innerHTML = orders
            .map((o) => {
              const itemNames = (o.items || []).map((i) => `${i.name} (${formatPrice(i.price)})`).join(', ');
              const dateStr = new Date(o.createdAt).toLocaleString();
              return `
              <div class="order-row">
                <div class="order-row-top">
                  <span>👤 ${escapeHtml(o.buyerName)}</span>
                  <span style="color:var(--poison-green);">${formatPrice(o.total)}</span>
                </div>
                <div style="font-size:0.88rem;margin-bottom:4px;">🃏 ${escapeHtml(itemNames)}</div>
                <div class="order-row-meta">
                  ${o.buyerNote ? `📝 ${escapeHtml(o.buyerNote)} • ` : ''}${escapeHtml(dateStr)}
                </div>
              </div>
            `;
            })
            .join('');
        }
        openModal('orders-modal');
      } catch (err) {
        showToast('Error loading orders: ' + err.message);
      }
    });

    // 5. Image Upload Dropzone & Live Card Preview
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('card-image-input');

    const handleChosenFile = async (file) => {
      if (!file) return;
      try {
        const dataUrl = await compressImageFile(file);
        state.uploadedImageData = dataUrl;
        document.getElementById('upload-placeholder').classList.add('hidden');
        document.getElementById('upload-selected').classList.remove('hidden');
        document.getElementById('image-upload-error').classList.add('hidden');

        const prevImg = document.getElementById('preview-img');
        prevImg.src = dataUrl;
        prevImg.classList.remove('hidden');
        document.getElementById('preview-empty-art').classList.add('hidden');
      } catch (err) {
        const errEl = document.getElementById('image-upload-error');
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
      }
    };

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleChosenFile(e.target.files[0]);
      }
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleChosenFile(e.dataTransfer.files[0]);
      }
    });

    document.getElementById('card-name-input').addEventListener('input', (e) => {
      document.getElementById('preview-name').textContent = e.target.value.trim() || 'Your Card Name';
    });
    document.getElementById('card-price-input').addEventListener('input', (e) => {
      document.getElementById('preview-price').textContent = formatPrice(e.target.value);
    });
    document.getElementById('card-grade-input').addEventListener('change', (e) => {
      const val = e.target.value;
      document.getElementById('preview-grade').textContent = val || 'Grade?';
      if (val) {
        e.target.classList.remove('input-invalid');
        document.getElementById('grade-error').classList.add('hidden');
      }
    });
    document.getElementById('card-finish-input').addEventListener('change', (e) => {
      const val = e.target.value;
      const prevFinish = document.getElementById('preview-finish');
      prevFinish.textContent = val ? formatFinishText(val) : 'Foil / Normal?';
      prevFinish.classList.toggle('is-foil', isFoilFinish(val));
      if (val) {
        e.target.classList.remove('input-invalid');
        document.getElementById('finish-error').classList.add('hidden');
      }
    });
    document.getElementById('card-desc-input').addEventListener('input', (e) => {
      document.getElementById('preview-desc').textContent =
        e.target.value.trim() || 'Card details will appear here.';
    });

    // Submit New Card Listing
    document.getElementById('list-card-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const imgErr = document.getElementById('image-upload-error');
      const gradeErr = document.getElementById('grade-error');
      const finishErr = document.getElementById('finish-error');
      const formErr = document.getElementById('list-form-error');
      const gradeSelect = document.getElementById('card-grade-input');
      const finishSelect = document.getElementById('card-finish-input');

      imgErr.classList.add('hidden');
      gradeErr.classList.add('hidden');
      finishErr.classList.add('hidden');
      formErr.classList.add('hidden');
      gradeSelect.classList.remove('input-invalid');
      finishSelect.classList.remove('input-invalid');

      let hasError = false;

      if (!state.uploadedImageData) {
        imgErr.textContent = 'You have to upload an image of the card to list it!';
        imgErr.classList.remove('hidden');
        dropzone.classList.remove('shake-error');
        void dropzone.offsetWidth;
        dropzone.classList.add('shake-error');
        hasError = true;
      }

      const name = document.getElementById('card-name-input').value.trim();
      const priceVal = parseFloat(document.getElementById('card-price-input').value);
      const grade = gradeSelect.value.trim();
      const finish = finishSelect.value.trim();
      const description = document.getElementById('card-desc-input').value.trim();

      if (!grade) {
        gradeErr.classList.remove('hidden');
        gradeSelect.classList.add('input-invalid');
        hasError = true;
      }

      if (!finish) {
        finishErr.classList.remove('hidden');
        finishSelect.classList.add('input-invalid');
        hasError = true;
      }

      if (!name) {
        formErr.textContent = 'Please enter the card name.';
        formErr.classList.remove('hidden');
        hasError = true;
      } else if (isNaN(priceVal) || priceVal <= 0) {
        formErr.textContent = 'Please enter a valid sale price greater than $0.00.';
        formErr.classList.remove('hidden');
        hasError = true;
      }

      if (hasError) return;

      const submitBtn = document.getElementById('submit-card-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Listing Card...';

      try {
        const backend = await getBackend();
        const created = await backend.createCard(state.ownerPin, {
          name,
          price: Number(priceVal.toFixed(2)),
          grade,
          finish,
          description,
          imageData: state.uploadedImageData
        });
        state.cards.unshift(created);
        state.filter = 'available';
        document.querySelectorAll('.filter-pill').forEach((b) => {
          b.classList.toggle('active', b.dataset.filter === 'available');
        });
        closeModal('list-modal');
        renderCards();
        showToast(`🪲 Listed "${created.name}" (${created.grade} • ${created.finish}) for ${formatPrice(created.price)}!`);

        document.getElementById('cards-section').scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        formErr.textContent = err.message || 'Failed to list card.';
        formErr.classList.remove('hidden');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'List Card for Sale';
      }
    });

    // 6. Card Grid Delegated Actions (Zoom, Cart, Buy, Owner Edit/Delete/Relist)
    const cardsGridEl = document.getElementById('cards-grid');

    // Interactive 3D Holo Tilt on Mousemove when holoTilt is enabled
    cardsGridEl.addEventListener('mousemove', (e) => {
      if (!state.config.holoTilt) return;
      const cardEl = e.target.closest('.trading-card');
      if (!cardEl) return;
      const rect = cardEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardEl.style.transform = `perspective(700px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-5px)`;
    });

    cardsGridEl.addEventListener('mouseleave', () => {
      cardsGridEl.querySelectorAll('.trading-card').forEach((el) => {
        el.style.transform = '';
      });
    }, true);

    cardsGridEl.addEventListener('mouseout', (e) => {
      const cardEl = e.target.closest('.trading-card');
      if (cardEl && !cardEl.contains(e.relatedTarget)) {
        cardEl.style.transform = '';
      }
    });

    cardsGridEl.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const id = target.dataset.id;
      const card = state.cards.find((c) => c.id === id);
      if (!card) return;

      if (action === 'zoom') {
        openZoomModal(id);
      } else if (action === 'toggle-cart') {
        const idx = state.cartIds.indexOf(id);
        if (idx >= 0) {
          state.cartIds.splice(idx, 1);
          showToast(`Removed "${card.name}" from cart.`);
        } else {
          state.cartIds.push(id);
          showToast(`🛒 Added "${card.name}" to cart!`);
        }
        saveCart();
        renderCards();
      } else if (action === 'buy-now') {
        if (!state.cartIds.includes(id)) {
          state.cartIds.push(id);
          saveCart();
          renderCards();
        }
        openCart();
      } else if (action === 'edit-price') {
        populateGradeAndFinishSelects();
        state.editedCardImageData = '';
        const editImgInput = document.getElementById('edit-image-input');
        if (editImgInput) editImgInput.value = '';
        document.getElementById('edit-card-id').value = card.id;
        document.getElementById('edit-card-name-label').textContent = `Editing: ${card.name}`;
        document.getElementById('edit-name-input').value = card.name;
        document.getElementById('edit-price-input').value = Number(card.price).toFixed(2);

        const gradeSel = document.getElementById('edit-grade-input');
        const curGrade = getCardGrade(card);
        if (![...gradeSel.options].some((o) => o.value === curGrade)) {
          gradeSel.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(curGrade)}">${escapeHtml(curGrade)}</option>`);
        }
        gradeSel.value = curGrade;

        const finishSel = document.getElementById('edit-finish-input');
        const curFinish = getCardFinish(card);
        if (![...finishSel.options].some((o) => o.value === curFinish)) {
          finishSel.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(curFinish)}">${escapeHtml(curFinish)}</option>`);
        }
        finishSel.value = curFinish;

        document.getElementById('edit-desc-input').value = card.description || '';
        openModal('edit-price-modal');
      } else if (action === 'relist') {
        try {
          const backend = await getBackend();
          const updated = await backend.updateCard(state.ownerPin, card.id, { sold: false });
          const idx = state.cards.findIndex((c) => c.id === card.id);
          if (idx >= 0) state.cards[idx] = updated;
          renderCards();
          showToast(`↺ Relisted "${card.name}" for ${formatPrice(card.price)}!`);
        } catch (err) {
          showToast(err.message);
        }
      } else if (action === 'delete-card') {
        if (!window.confirm(`Delete "${card.name}" from the shop?`)) return;
        try {
          const backend = await getBackend();
          await backend.deleteCard(state.ownerPin, card.id);
          state.cards = state.cards.filter((c) => c.id !== card.id);
          sanitizeCart();
          renderCards();
          showToast(`🗑️ Deleted "${card.name}".`);
        } catch (err) {
          showToast(err.message);
        }
      }
    });

    // Optional Photo Swap in Edit Card Modal
    const editImageInput = document.getElementById('edit-image-input');
    if (editImageInput) {
      editImageInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          try {
            state.editedCardImageData = await compressImageFile(e.target.files[0]);
            showToast('📸 New card photo ready to save!');
          } catch (err) {
            showToast(err.message);
          }
        }
      });
    }

    // Save Edited Card (Name, Price, Grade, Finish, Description, Optional Photo)
    document.getElementById('edit-price-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-card-id').value;
      const newName = document.getElementById('edit-name-input').value.trim();
      const newPrice = parseFloat(document.getElementById('edit-price-input').value);
      const newGrade = document.getElementById('edit-grade-input').value.trim();
      const newFinish = document.getElementById('edit-finish-input').value.trim();
      const newDesc = document.getElementById('edit-desc-input').value.trim();
      if (!newName || isNaN(newPrice) || newPrice <= 0) return;
      try {
        const backend = await getBackend();
        const patch = {
          name: newName,
          price: Number(newPrice.toFixed(2)),
          grade: newGrade,
          finish: newFinish,
          description: newDesc
        };
        if (state.editedCardImageData) {
          patch.imageData = state.editedCardImageData;
        }
        const updated = await backend.updateCard(state.ownerPin, id, patch);
        const idx = state.cards.findIndex((c) => c.id === id);
        if (idx >= 0) state.cards[idx] = updated;
        closeModal('edit-price-modal');
        renderCards();
        showToast(`✨ Updated "${updated.name}" (${formatPrice(updated.price)})!`);
      } catch (err) {
        showToast(err.message);
      }
    });

    // 7. Cart & Checkout Drawer
    document.getElementById('cart-toggle-btn').addEventListener('click', openCart);
    document.getElementById('close-cart-btn').addEventListener('click', closeCart);
    document.getElementById('cart-backdrop').addEventListener('click', closeCart);

    document.getElementById('cart-items-container').addEventListener('click', (e) => {
      const rmBtn = e.target.closest('[data-remove-cart]');
      if (!rmBtn) return;
      const id = rmBtn.dataset.removeCart;
      state.cartIds = state.cartIds.filter((cid) => cid !== id);
      saveCart();
      renderCartDrawer();
      renderCards();
    });

    document.getElementById('checkout-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const buyerName = document.getElementById('buyer-name').value.trim();
      const buyerNote = document.getElementById('buyer-note').value.trim();
      if (!buyerName || state.cartIds.length === 0) return;

      const btn = document.getElementById('checkout-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Completing Order...';

      const backend = await getBackend();
      try {
        const order = await backend.checkout({
          cardIds: [...state.cartIds],
          buyerName,
          buyerNote
        });

        state.cards = await backend.getCards();
        state.cartIds = [];
        saveCart();
        document.getElementById('checkout-form').reset();
        closeCart();
        renderCards();

        const receiptEl = document.getElementById('success-receipt');
        receiptEl.innerHTML = `
          <div><strong>Buyer:</strong> ${escapeHtml(order.buyerName)}</div>
          <div style="margin:6px 0;"><strong>Cards Purchased:</strong> ${(order.items || [])
            .map((i) => escapeHtml(i.name))
            .join(', ')}</div>
          <div><strong>Total Paid:</strong> <span style="color:var(--poison-green);font-weight:800;">${formatPrice(order.total)}</span></div>
        `;
        openModal('success-modal');
      } catch (err) {
        showToast('⚠️ ' + err.message);
        state.cards = await backend.getCards();
        sanitizeCart();
        renderCartDrawer();
        renderCards();
      } finally {
        btn.disabled = false;
      }
    });

    // 8. Shop Customizer Studio Drawer Events
    document.getElementById('customize-open-btn').addEventListener('click', openCustomizer);
    document.getElementById('owner-customize-btn').addEventListener('click', openCustomizer);
    document.getElementById('close-customizer-btn').addEventListener('click', closeCustomizer);
    document.getElementById('customizer-backdrop').addEventListener('click', closeCustomizer);
    document.getElementById('cust-save-close-btn').addEventListener('click', () => {
      persistShopConfig();
      closeCustomizer();
      showToast('🎨 Shop customizations saved!');
    });

    // Customizer Tabs
    document.querySelectorAll('[data-cust-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const targetTab = tabBtn.dataset.custTab;
        document.querySelectorAll('[data-cust-tab]').forEach((b) => {
          b.classList.toggle('active', b.dataset.custTab === targetTab);
        });
        document.querySelectorAll('[data-cust-panel]').forEach((panel) => {
          panel.classList.toggle('hidden', panel.dataset.custPanel !== targetTab);
        });
      });
    });

    // 1-Click Theme Presets
    document.getElementById('theme-presets-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-preset-key]');
      if (!btn) return;
      const key = btn.dataset.presetKey;
      const preset = THEME_PRESETS[key];
      if (!preset) return;
      updateConfigField({
        preset: key,
        colorPrimary: preset.colorPrimary,
        colorAccent: preset.colorAccent,
        colorBg: preset.colorBg,
        colorCard: preset.colorCard,
        bugShellColor: preset.bugShellColor,
        bugSpotsColor: preset.bugSpotsColor
      });
      syncCustomizerInputsFromState();
      showToast(`🎨 Applied "${preset.name}" theme!`);
    });

    // Live Color Pickers & Theme Controls
    document.getElementById('cust-color-primary').addEventListener('input', (e) => {
      updateConfigField({ preset: 'custom', colorPrimary: e.target.value });
      renderThemePresets();
    });
    document.getElementById('cust-color-accent').addEventListener('input', (e) => {
      updateConfigField({ preset: 'custom', colorAccent: e.target.value });
      renderThemePresets();
    });
    document.getElementById('cust-color-bg').addEventListener('input', (e) => {
      updateConfigField({ preset: 'custom', colorBg: e.target.value });
      renderThemePresets();
    });
    document.getElementById('cust-color-card').addEventListener('input', (e) => {
      updateConfigField({ preset: 'custom', colorCard: e.target.value });
      renderThemePresets();
    });
    document.getElementById('cust-bg-pattern').addEventListener('change', (e) => {
      updateConfigField({ bgPattern: e.target.value });
    });
    document.getElementById('cust-font-style').addEventListener('change', (e) => {
      updateConfigField({ fontStyle: e.target.value });
    });

    // Top Bug & Brand Controls
    document.getElementById('cust-brand-first').addEventListener('input', (e) => {
      updateConfigField({ brandFirst: e.target.value });
    });
    document.getElementById('cust-brand-second').addEventListener('input', (e) => {
      updateConfigField({ brandSecond: e.target.value });
    });
    document.getElementById('cust-brand-tag').addEventListener('input', (e) => {
      updateConfigField({ brandTag: e.target.value });
    });
    document.getElementById('cust-bug-shell').addEventListener('input', (e) => {
      updateConfigField({ bugShellColor: e.target.value });
    });
    document.getElementById('cust-bug-spots').addEventListener('input', (e) => {
      updateConfigField({ bugSpotsColor: e.target.value });
    });
    document.getElementById('cust-bug-size').addEventListener('input', (e) => {
      const sz = Number(e.target.value) || 38;
      document.getElementById('cust-bug-size-val').textContent = `${sz}px`;
      updateConfigField({ bugSize: sz });
    });
    document.getElementById('cust-bug-anim').addEventListener('change', (e) => {
      updateConfigField({ bugAnim: e.target.value });
    });
    document.getElementById('cust-bug-messages').addEventListener('input', (e) => {
      const lines = e.target.value
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      updateConfigField({ bugMessages: lines.length ? lines : [...BUG_MESSAGES] });
    });

    // Cards & Grid Layout Controls
    document.getElementById('cust-grid-density').addEventListener('change', (e) => {
      updateConfigField({ gridDensity: e.target.value });
    });
    document.getElementById('cust-card-frame').addEventListener('change', (e) => {
      updateConfigField({ cardFrame: e.target.value });
    });
    document.getElementById('cust-card-radius').addEventListener('input', (e) => {
      const r = Number(e.target.value) || 18;
      document.getElementById('cust-card-radius-val').textContent = `${r}px`;
      updateConfigField({ cardRadius: r });
    });
    document.getElementById('cust-image-fit').addEventListener('change', (e) => {
      updateConfigField({ imageFit: e.target.value });
    });
    document.getElementById('cust-holo-tilt').addEventListener('change', (e) => {
      updateConfigField({ holoTilt: e.target.checked });
    });
    document.getElementById('cust-price-reveal').addEventListener('change', (e) => {
      updateConfigField({ priceReveal: e.target.value }, true);
    });
    document.getElementById('cust-currency').addEventListener('change', (e) => {
      updateConfigField({ currency: e.target.value }, true);
    });

    // Texts, Banner & Custom Grades/Finishes Controls
    document.getElementById('cust-banner-enabled').addEventListener('change', (e) => {
      updateConfigField({ bannerEnabled: e.target.checked });
    });
    document.getElementById('cust-banner-text').addEventListener('input', (e) => {
      updateConfigField({ bannerText: e.target.value });
    });
    document.getElementById('cust-hero-main').addEventListener('input', (e) => {
      updateConfigField({ heroMain: e.target.value });
    });
    document.getElementById('cust-hero-highlight').addEventListener('input', (e) => {
      updateConfigField({ heroHighlight: e.target.value });
    });
    document.getElementById('cust-hero-sub').addEventListener('input', (e) => {
      updateConfigField({ heroSub: e.target.value });
    });
    document.getElementById('cust-show-showcase').addEventListener('change', (e) => {
      updateConfigField({ showShowcase: e.target.checked });
    });
    document.getElementById('cust-section-title').addEventListener('input', (e) => {
      updateConfigField({ sectionTitle: e.target.value });
    });
    document.getElementById('cust-search-placeholder').addEventListener('input', (e) => {
      updateConfigField({ searchPlaceholder: e.target.value });
    });

    // Add / Remove Custom Grades
    const addGrade = () => {
      const inp = document.getElementById('cust-new-grade');
      const val = inp.value.trim();
      if (!val) return;
      if (!state.config.customGrades.includes(val)) {
        state.config.customGrades.push(val);
        updateConfigField({ customGrades: [...state.config.customGrades] });
        renderTagChips();
      }
      inp.value = '';
    };
    document.getElementById('cust-add-grade-btn').addEventListener('click', addGrade);
    document.getElementById('cust-new-grade').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addGrade();
      }
    });
    document.getElementById('cust-grades-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-grade]');
      if (!btn) return;
      if (state.config.customGrades.length <= 1) {
        showToast('Keep at least 1 grade option!');
        return;
      }
      const idx = Number(btn.dataset.removeGrade);
      state.config.customGrades.splice(idx, 1);
      updateConfigField({ customGrades: [...state.config.customGrades] });
      renderTagChips();
    });

    // Add / Remove Custom Finishes
    const addFinish = () => {
      const inp = document.getElementById('cust-new-finish');
      const val = inp.value.trim();
      if (!val) return;
      if (!state.config.customFinishes.includes(val)) {
        state.config.customFinishes.push(val);
        updateConfigField({ customFinishes: [...state.config.customFinishes] });
        renderTagChips();
      }
      inp.value = '';
    };
    document.getElementById('cust-add-finish-btn').addEventListener('click', addFinish);
    document.getElementById('cust-new-finish').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addFinish();
      }
    });
    document.getElementById('cust-finishes-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-finish]');
      if (!btn) return;
      if (state.config.customFinishes.length <= 1) {
        showToast('Keep at least 1 finish option!');
        return;
      }
      const idx = Number(btn.dataset.removeFinish);
      state.config.customFinishes.splice(idx, 1);
      updateConfigField({ customFinishes: [...state.config.customFinishes] });
      renderTagChips();
    });

    // Export / Import / Reset Customizer Config
    document.getElementById('cust-export-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'poisonbug-theme.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('⬇ Exported poisonbug-theme.json!');
    });

    const importFileInp = document.getElementById('cust-import-file');
    document.getElementById('cust-import-btn').addEventListener('click', () => importFileInp.click());
    importFileInp.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          state.config = {
            ...DEFAULT_SHOP_CONFIG,
            ...parsed,
            bugMessages: Array.isArray(parsed.bugMessages) && parsed.bugMessages.length ? parsed.bugMessages : [...BUG_MESSAGES],
            customGrades: Array.isArray(parsed.customGrades) && parsed.customGrades.length ? parsed.customGrades : [...DEFAULT_GRADES],
            customFinishes: Array.isArray(parsed.customFinishes) && parsed.customFinishes.length ? parsed.customFinishes : [...DEFAULT_FINISHES]
          };
          applyShopConfig();
          persistShopConfig();
          syncCustomizerInputsFromState();
          renderCards();
          showToast('⬆ Imported custom shop theme!');
        } catch (_) {
          showToast('⚠️ Invalid theme JSON file.');
        }
      };
      reader.readAsText(file);
      importFileInp.value = '';
    });

    document.getElementById('cust-reset-btn').addEventListener('click', () => {
      state.config = {
        ...DEFAULT_SHOP_CONFIG,
        bugMessages: [...BUG_MESSAGES],
        customGrades: [...DEFAULT_GRADES],
        customFinishes: [...DEFAULT_FINISHES]
      };
      applyShopConfig();
      persistShopConfig();
      syncCustomizerInputsFromState();
      renderCards();
      showToast('↺ Reset shop theme & settings to default!');
    });

    // Close Modal Buttons & Escape Key
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.add('hidden'));
        closeCart();
        closeCustomizer();
      }
    });
  }

  // =========================================================
  // BOOTSTRAP
  // =========================================================
  async function init() {
    applyShopConfig();
    bindEvents();
    const backend = await getBackend();

    // Load saved backend config if available
    if (backend && backend.getConfig) {
      const savedCfg = await backend.getConfig().catch(() => null);
      if (savedCfg && typeof savedCfg === 'object') {
        state.config = {
          ...DEFAULT_SHOP_CONFIG,
          ...savedCfg,
          bugMessages:
            Array.isArray(savedCfg.bugMessages) && savedCfg.bugMessages.length
              ? savedCfg.bugMessages
              : [...DEFAULT_SHOP_CONFIG.bugMessages],
          customGrades:
            Array.isArray(savedCfg.customGrades) && savedCfg.customGrades.length
              ? savedCfg.customGrades
              : [...DEFAULT_SHOP_CONFIG.customGrades],
          customFinishes:
            Array.isArray(savedCfg.customFinishes) && savedCfg.customFinishes.length
              ? savedCfg.customFinishes
              : [...DEFAULT_SHOP_CONFIG.customFinishes]
        };
        localStorage.setItem('poisonbug_shop_config', JSON.stringify(state.config));
        applyShopConfig();
      }
    }

    // Verify stored session PIN is still valid
    if (state.ownerPin) {
      const stillValid = await backend.verifyPin(state.ownerPin).catch(() => false);
      if (!stillValid) {
        state.ownerPin = null;
        sessionStorage.removeItem('poisonbug_owner_pin');
      }
    }

    state.cards = await backend.getCards();
    sanitizeCart();
    updateOwnerUi();
  }

  init();
})();
