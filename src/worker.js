import { DurableObject } from 'cloudflare:workers';

export class PoisonBugStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.initSchema();
  }

  initSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO settings (key, value) VALUES ('owner_pin', '1234');
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        grade TEXT NOT NULL DEFAULT 'Near Mint',
        finish TEXT NOT NULL DEFAULT 'Holo Foil',
        description TEXT NOT NULL DEFAULT '',
        image_data TEXT NOT NULL,
        sold INTEGER NOT NULL DEFAULT 0,
        sold_at TEXT,
        buyer_name TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        buyer_name TEXT NOT NULL,
        buyer_note TEXT NOT NULL DEFAULT '',
        total REAL NOT NULL,
        items_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const cols = [...this.sql.exec(`PRAGMA table_info(cards)`)].map((c) => c.name);
    if (!cols.includes('grade')) {
      this.sql.exec(`ALTER TABLE cards ADD COLUMN grade TEXT NOT NULL DEFAULT 'Near Mint'`);
    }
    if (!cols.includes('finish')) {
      this.sql.exec(`ALTER TABLE cards ADD COLUMN finish TEXT NOT NULL DEFAULT 'Holo Foil'`);
    }

    const cleared = [...this.sql.exec(`SELECT value FROM settings WHERE key = 'cleared_unlisted_v3'`)];
    if (cleared.length === 0) {
      this.sql.exec(`DELETE FROM cards WHERE id LIKE 'starter-%' OR id LIKE 'poke-%'`);
      this.sql.exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('cleared_unlisted_v3', '1')`);
    }
  }

  getOwnerPin() {
    const rows = [...this.sql.exec(`SELECT value FROM settings WHERE key = 'owner_pin'`)];
    return rows[0] ? rows[0].value : '1234';
  }

  mapCard(row) {
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      grade: row.grade || row.rarity || 'Near Mint',
      finish: row.finish || 'Holo Foil',
      description: row.description,
      imageData: row.image_data,
      sold: Boolean(row.sold),
      soldAt: row.sold_at || null,
      buyerName: row.buyer_name || null,
      createdAt: row.created_at
    };
  }

  json(status, data) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;
      const checkPin = () => {
        const p = request.headers.get('x-owner-pin');
        return Boolean(p && String(p) === String(this.getOwnerPin()));
      };

      if (pathname === '/api/health' && method === 'GET') {
        return this.json(200, { ok: true, mode: 'cloudflare' });
      }

      if (pathname === '/api/verify-pin' && method === 'POST') {
        const body = await request.json();
        return this.json(200, { valid: Boolean(body.pin && String(body.pin) === String(this.getOwnerPin())) });
      }

      if (pathname === '/api/change-pin' && method === 'POST') {
        const body = await request.json();
        if (String(body.currentPin || '') !== String(this.getOwnerPin())) {
          return this.json(403, { error: 'Current Owner PIN is incorrect.' });
        }
        const nextPin = String(body.newPin || '').trim();
        if (nextPin.length < 4) {
          return this.json(400, { error: 'New PIN must be at least 4 characters.' });
        }
        this.sql.exec(`INSERT OR REPLACE INTO settings (key, value) VALUES ('owner_pin', ?)`, nextPin);
        return this.json(200, { ok: true });
      }

      if (pathname === '/api/cards' && method === 'GET') {
        const rows = [...this.sql.exec(`SELECT * FROM cards ORDER BY created_at DESC`)];
        return this.json(200, { cards: rows.map((r) => this.mapCard(r)) });
      }

      if (pathname === '/api/cards' && method === 'POST') {
        if (!checkPin()) return this.json(403, { error: 'Invalid Owner PIN.' });
        const body = await request.json();
        const name = String(body.name || '').trim();
        const price = Number(body.price);
        const grade = String(body.grade || '').trim();
        const finish = String(body.finish || '').trim();
        const description = String(body.description || '').trim();
        const imageData = String(body.imageData || '');

        if (!imageData.startsWith('data:image/')) {
          return this.json(400, { error: 'You must upload a card image to list a card.' });
        }
        if (!grade) {
          return this.json(400, { error: 'Card grade (Mint, Near Mint, etc.) is required.' });
        }
        if (!finish) {
          return this.json(400, { error: 'Card finish (Foil, Normal, etc.) is required.' });
        }
        if (!name || !Number.isFinite(price) || price <= 0) {
          return this.json(400, { error: 'Card name and valid sale price are required.' });
        }

        const id = 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        const createdAt = new Date().toISOString();
        this.sql.exec(
          `INSERT INTO cards (id, name, price, grade, finish, description, image_data, sold, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          id,
          name,
          Number(price.toFixed(2)),
          grade,
          finish,
          description,
          imageData,
          createdAt
        );
        const created = [...this.sql.exec(`SELECT * FROM cards WHERE id = ?`, id)][0];
        return this.json(201, { card: this.mapCard(created) });
      }

      if (pathname.startsWith('/api/cards/') && (method === 'PATCH' || method === 'DELETE')) {
        if (!checkPin()) return this.json(403, { error: 'Invalid Owner PIN.' });
        const id = decodeURIComponent(pathname.slice('/api/cards/'.length));
        const existing = [...this.sql.exec(`SELECT * FROM cards WHERE id = ?`, id)][0];
        if (!existing) return this.json(404, { error: 'Card not found.' });

        if (method === 'DELETE') {
          this.sql.exec(`DELETE FROM cards WHERE id = ?`, id);
          return this.json(200, { ok: true });
        }

        const body = await request.json();
        const nextPrice = body.price !== undefined ? Number(body.price) : Number(existing.price);
        const nextSold = body.sold !== undefined ? (body.sold ? 1 : 0) : existing.sold;
        const nextSoldAt = nextSold ? existing.sold_at : null;
        const nextBuyer = nextSold ? existing.buyer_name : null;

        this.sql.exec(
          `UPDATE cards SET price = ?, sold = ?, sold_at = ?, buyer_name = ? WHERE id = ?`,
          Number(nextPrice.toFixed(2)),
          nextSold,
          nextSoldAt,
          nextBuyer,
          id
        );
        const updated = [...this.sql.exec(`SELECT * FROM cards WHERE id = ?`, id)][0];
        return this.json(200, { card: this.mapCard(updated) });
      }

      if (pathname === '/api/checkout' && method === 'POST') {
        const body = await request.json();
        const cardIds = Array.isArray(body.cardIds) ? body.cardIds : [];
        const buyerName = String(body.buyerName || '').trim();
        const buyerNote = String(body.buyerNote || '').trim();

        if (!buyerName || cardIds.length === 0) {
          return this.json(400, { error: 'Buyer name and cards are required.' });
        }

        const items = [];
        let total = 0;
        const now = new Date().toISOString();

        for (const id of cardIds) {
          const row = [...this.sql.exec(`SELECT * FROM cards WHERE id = ?`, id)][0];
          if (!row) return this.json(400, { error: 'One of the cards is no longer available.' });
          if (row.sold) return this.json(400, { error: `"${row.name}" was already purchased!` });
          items.push({ id: row.id, name: row.name, price: Number(row.price) });
          total += Number(row.price);
        }

        for (const item of items) {
          this.sql.exec(`UPDATE cards SET sold = 1, sold_at = ?, buyer_name = ? WHERE id = ?`, now, buyerName, item.id);
        }

        const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const finalTotal = Number(total.toFixed(2));
        this.sql.exec(
          `INSERT INTO orders (id, buyer_name, buyer_note, total, items_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          orderId,
          buyerName,
          buyerNote,
          finalTotal,
          JSON.stringify(items),
          now
        );

        return this.json(200, {
          order: { id: orderId, buyerName, buyerNote, total: finalTotal, items, createdAt: now }
        });
      }

      if (pathname === '/api/orders' && method === 'GET') {
        if (!checkPin()) return this.json(403, { error: 'Invalid Owner PIN.' });
        const rows = [...this.sql.exec(`SELECT * FROM orders ORDER BY created_at DESC`)];
        return this.json(200, {
          orders: rows.map((r) => ({
            id: r.id,
            buyerName: r.buyer_name,
            buyerNote: r.buyer_note,
            total: Number(r.total),
            items: JSON.parse(r.items_json || '[]'),
            createdAt: r.created_at
          }))
        });
      }

      return this.json(404, { error: 'Not found' });
    } catch (err) {
      return this.json(500, { error: err.message || 'Server error' });
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const id = env.STORE.idFromName('global');
      const stub = env.STORE.get(id);
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
