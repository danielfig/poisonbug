CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

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
