const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const starterCards = require('./public/seed-cards.js');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'poisonbug.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

// Ensure grade & finish columns exist if upgrading an older local DB
const cols = db.prepare(`PRAGMA table_info(cards)`).all().map((c) => c.name);
if (!cols.includes('grade')) {
  db.exec(`ALTER TABLE cards ADD COLUMN grade TEXT NOT NULL DEFAULT 'Near Mint'`);
}
if (!cols.includes('finish')) {
  db.exec(`ALTER TABLE cards ADD COLUMN finish TEXT NOT NULL DEFAULT 'Holo Foil'`);
}

// Seed real Pokémon cards and remove any old placeholder cards
const seededPokemonRow = db.prepare(`SELECT value FROM settings WHERE key = 'seeded_pokemon_v2'`).get();
if (!seededPokemonRow) {
  db.exec(`DELETE FROM cards WHERE id LIKE 'starter-%'`);
  const insertCard = db.prepare(`
    INSERT OR IGNORE INTO cards (id, name, price, grade, finish, description, image_data, sold, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of starterCards) {
    insertCard.run(
      c.id,
      c.name,
      c.price,
      c.grade,
      c.finish,
      c.description,
      c.imageData,
      c.sold ? 1 : 0,
      c.createdAt
    );
  }
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('seeded_pokemon_v2', '1')`).run();
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req, maxBytes = 6 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Image or payload is too large (max 6MB).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function getOwnerPin() {
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'owner_pin'`).get();
  return row ? row.value : '1234';
}

function checkOwnerHeader(req) {
  const provided = req.headers['x-owner-pin'];
  return Boolean(provided && String(provided) === String(getOwnerPin()));
}

function mapCardRow(row) {
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // API ROUTES
    if (pathname === '/api/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, mode: 'server' });
    }

    if (pathname === '/api/verify-pin' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const valid = Boolean(body.pin && String(body.pin) === String(getOwnerPin()));
      return sendJson(res, 200, { valid });
    }

    if (pathname === '/api/change-pin' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (String(body.currentPin || '') !== String(getOwnerPin())) {
        return sendJson(res, 403, { error: 'Current Owner PIN is incorrect.' });
      }
      const nextPin = String(body.newPin || '').trim();
      if (nextPin.length < 4) {
        return sendJson(res, 400, { error: 'New PIN must be at least 4 characters.' });
      }
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('owner_pin', ?)`).run(nextPin);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === '/api/cards' && req.method === 'GET') {
      const rows = db.prepare(`SELECT * FROM cards ORDER BY created_at DESC`).all();
      return sendJson(res, 200, { cards: rows.map(mapCardRow) });
    }

    if (pathname === '/api/cards' && req.method === 'POST') {
      if (!checkOwnerHeader(req)) {
        return sendJson(res, 403, { error: 'Invalid Owner PIN.' });
      }
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      const price = Number(body.price);
      const grade = String(body.grade || '').trim();
      const finish = String(body.finish || '').trim();
      const description = String(body.description || '').trim();
      const imageData = String(body.imageData || '');

      if (!imageData.startsWith('data:image/')) {
        return sendJson(res, 400, { error: 'You must upload a card image to list a card.' });
      }
      if (!grade) {
        return sendJson(res, 400, { error: 'Card grade (Mint, Near Mint, etc.) is required.' });
      }
      if (!finish) {
        return sendJson(res, 400, { error: 'Card finish (Foil, Normal, etc.) is required.' });
      }
      if (!name) {
        return sendJson(res, 400, { error: 'Card name is required.' });
      }
      if (!Number.isFinite(price) || price <= 0) {
        return sendJson(res, 400, { error: 'Valid sale price is required.' });
      }

      const id = 'card-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO cards (id, name, price, grade, finish, description, image_data, sold, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(id, name, Number(price.toFixed(2)), grade, finish, description, imageData, createdAt);

      const created = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id);
      return sendJson(res, 201, { card: mapCardRow(created) });
    }

    if (pathname.startsWith('/api/cards/') && (req.method === 'PATCH' || req.method === 'DELETE')) {
      if (!checkOwnerHeader(req)) {
        return sendJson(res, 403, { error: 'Invalid Owner PIN.' });
      }
      const id = decodeURIComponent(pathname.slice('/api/cards/'.length));
      const existing = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id);
      if (!existing) {
        return sendJson(res, 404, { error: 'Card not found.' });
      }

      if (req.method === 'DELETE') {
        db.prepare(`DELETE FROM cards WHERE id = ?`).run(id);
        return sendJson(res, 200, { ok: true });
      }

      const body = await readJsonBody(req);
      const nextPrice = body.price !== undefined ? Number(body.price) : Number(existing.price);
      const nextSold = body.sold !== undefined ? (body.sold ? 1 : 0) : existing.sold;
      const nextSoldAt = nextSold ? existing.sold_at : null;
      const nextBuyer = nextSold ? existing.buyer_name : null;

      db.prepare(`
        UPDATE cards
        SET price = ?, sold = ?, sold_at = ?, buyer_name = ?
        WHERE id = ?
      `).run(Number(nextPrice.toFixed(2)), nextSold, nextSoldAt, nextBuyer, id);

      const updated = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id);
      return sendJson(res, 200, { card: mapCardRow(updated) });
    }

    if (pathname === '/api/checkout' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const cardIds = Array.isArray(body.cardIds) ? body.cardIds : [];
      const buyerName = String(body.buyerName || '').trim();
      const buyerNote = String(body.buyerNote || '').trim();

      if (!buyerName) {
        return sendJson(res, 400, { error: 'Please enter your name.' });
      }
      if (cardIds.length === 0) {
        return sendJson(res, 400, { error: 'Your cart is empty.' });
      }

      db.exec('BEGIN IMMEDIATE');
      try {
        const items = [];
        let total = 0;
        const now = new Date().toISOString();

        for (const id of cardIds) {
          const row = db.prepare(`SELECT * FROM cards WHERE id = ?`).get(id);
          if (!row) {
            throw new Error('One of the cards in your cart is no longer available.');
          }
          if (row.sold) {
            throw new Error(`"${row.name}" was already purchased!`);
          }
          db.prepare(`UPDATE cards SET sold = 1, sold_at = ?, buyer_name = ? WHERE id = ?`).run(
            now,
            buyerName,
            id
          );
          items.push({ id: row.id, name: row.name, price: Number(row.price) });
          total += Number(row.price);
        }

        const orderId = 'ord-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        const finalTotal = Number(total.toFixed(2));
        db.prepare(`
          INSERT INTO orders (id, buyer_name, buyer_note, total, items_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(orderId, buyerName, buyerNote, finalTotal, JSON.stringify(items), now);

        db.exec('COMMIT');
        return sendJson(res, 200, {
          order: {
            id: orderId,
            buyerName,
            buyerNote,
            total: finalTotal,
            items,
            createdAt: now
          }
        });
      } catch (txErr) {
        db.exec('ROLLBACK');
        return sendJson(res, 400, { error: txErr.message });
      }
    }

    if (pathname === '/api/orders' && req.method === 'GET') {
      if (!checkOwnerHeader(req)) {
        return sendJson(res, 403, { error: 'Invalid Owner PIN.' });
      }
      const rows = db.prepare(`SELECT * FROM orders ORDER BY created_at DESC`).all();
      const orders = rows.map((r) => ({
        id: r.id,
        buyerName: r.buyer_name,
        buyerNote: r.buyer_note,
        total: Number(r.total),
        items: JSON.parse(r.items_json || '[]'),
        createdAt: r.created_at
      }));
      return sendJson(res, 200, { orders });
    }

    // STATIC FILE SERVING
    const relPath = pathname === '/' ? '/index.html' : pathname;
    const safePath = path.normalize(path.join(PUBLIC_DIR, relPath));
    if (!safePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(safePath).pipe(res);
    }

    // Fallback to index.html
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(PUBLIC_DIR, 'index.html')).pipe(res);
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

server.listen(PORT, () => {
  console.log(`🪲 PoisonBug Card Shop running at http://localhost:${PORT}`);
});
