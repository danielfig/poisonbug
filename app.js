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
        const seededPokemon = await this.idbGet('settings', 'seeded_pokemon_v2');
        if (!seededPokemon) {
          const existingPinRec = await this.idbGet('settings', 'owner_pin');
          const pinToKeep = existingPinRec && existingPinRec.value ? existingPinRec.value : DEFAULT_PIN;
          const db = await this.open();
          const starters = window.POISONBUG_STARTER_CARDS || [];
          const oldPlaceholderIds = [
            'starter-venom-beetle',
            'starter-emerald-mantis',
            'starter-amethyst-drake',
            'starter-crystal-moth'
          ];
          await new Promise((resolve, reject) => {
            const t = db.transaction(['cards', 'settings'], 'readwrite');
            const cardStore = t.objectStore('cards');
            const setStore = t.objectStore('settings');
            for (const oldId of oldPlaceholderIds) {
              cardStore.delete(oldId);
            }
            for (const c of starters) {
              cardStore.put({ ...c });
            }
            setStore.put({ key: 'seeded', value: '1' });
            setStore.put({ key: 'seeded_pokemon_v2', value: '1' });
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
      if (patch.price !== undefined) existing.price = Number(patch.price);
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
  // APP STATE
  // =========================================================
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
    bugMsgIndex: 0,
    hasScrolledPastHero: false
  };

  function formatPrice(num) {
    const val = Number(num) || 0;
    return '$' + val.toFixed(2);
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
      countEl.textContent = 'Waiting for new owner listings';
    } else if (available.length === 1) {
      countEl.textContent = '1 Collectible Card Available Now';
    } else {
      countEl.textContent = `${available.length} Collectible Cards For Sale`;
    }

    const stack = document.getElementById('showcase-stack');
    const showcaseCards = (available.length ? available : state.cards).slice(0, 3);
    if (showcaseCards.length === 0) {
      stack.innerHTML = `<div class="showcase-mini-card" style="display:grid;place-items:center;padding:16px;text-align:center;color:#c084fc;font-weight:700;">🪲 List your first card!</div>`;
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
        const revealImmediately = state.hasScrolledPastHero || window.scrollY > 55 || Boolean(state.searchQuery.trim());
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
                <button type="button" class="owner-mini-btn" data-action="edit-price" data-id="${escapeHtml(card.id)}">🏷️ Price</button>
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
      state.bugMsgIndex = (state.bugMsgIndex + 1) % BUG_MESSAGES.length;
      bugSpeech.textContent = BUG_MESSAGES[state.bugMsgIndex];
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
    document.getElementById('cards-grid').addEventListener('click', async (e) => {
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
        document.getElementById('edit-card-id').value = card.id;
        document.getElementById('edit-card-name-label').textContent = `Card: ${card.name}`;
        document.getElementById('edit-price-input').value = Number(card.price).toFixed(2);
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

    // Save Edited Price
    document.getElementById('edit-price-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-card-id').value;
      const newPrice = parseFloat(document.getElementById('edit-price-input').value);
      if (isNaN(newPrice) || newPrice <= 0) return;
      try {
        const backend = await getBackend();
        const updated = await backend.updateCard(state.ownerPin, id, {
          price: Number(newPrice.toFixed(2))
        });
        const idx = state.cards.findIndex((c) => c.id === id);
        if (idx >= 0) state.cards[idx] = updated;
        closeModal('edit-price-modal');
        renderCards();
        showToast(`🏷️ Updated sale price to ${formatPrice(updated.price)}!`);
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
      }
    });
  }

  // =========================================================
  // BOOTSTRAP
  // =========================================================
  async function init() {
    bindEvents();
    const backend = await getBackend();

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
